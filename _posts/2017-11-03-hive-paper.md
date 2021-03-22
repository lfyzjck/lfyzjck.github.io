---
title: Hive 论文笔记
---
# {{ page.title }}

MapReduce 出现后，对数据的计算需求越来越多，而 MapReduce 提供的 API 太底层，学习成本和开发成本比较高，因此需要一个类 SQL 的工具，来代替大部分的 MapReduce 的使用场景。

### 数据模型，类型系统和查询语言

Hive 和传统的数据库一样有 Database 和 Table 的概念，数据存储在 Table 中。每个 Table 中会会很多行，每行有多列组成。

##### 类型

Hive 支持原生类型 (primitive types) 和复杂类型 (complex types)。

Primitive:

* Integers: bigint, int, smallint, tinyint
* Float: float, double
* String

Complex:

* map<key-type, value-type>
* list<element-type>
* struct<field-name, field-type, …>

SerDe , Format 都是可插拔的，用户可以自定义 SerDe 或者 Format，在查询时可以通过 HiveQL 增加自己的 SerDe:

```
ADD JAR /jars/myformat.jar;
CREATE TABLE t2
ROW FORMAT SERDE 'com.myformat.MySerDe';
```

##### HiveQL

HiveQL 和传统的 SQL 几乎没有差别，但是存在一些局限：

* 只能使用标准的 ANSI Join 语法
* JOIN 条件只能支持 `=` 运算符，不能使用 `>`, `<`
* Hive 不能支持正常的 `INSERT INTO`, 只能使用 `INSERT INTO OVERWRITE` 从已有的数据中生成

Hive 中可以直接调用 MapReduce 程序：

```
FROM (
  MAP doctext USING 'python wc_mapper.py' AS (word, cnt)
  FROM docs
  CLUSTER BY word
) a
REDUCE word, cnt USING 'python wc_reduce.py';
```

Hive 提供了 `CLUSTER BY` 和 `DISTRIBUTE BY` 等语法改善 Reduce 的数据分布，解决数据倾斜问题

### Data Storage, SerDe and File formats

##### Data Storage

Hive 的存储模型有 3 个层级

* Tables 对应 HDFS 的一个目录
* Partitions 是 Table 的子目录
* Buckets 是目录下具体的文件

> Partition 的字段不是 Table 数据的一部分，而是保存在目录的名称中。比如 `/usr/hive/warehouse/t1/p_date=20170701`

Partition 可以优化查询性能，当用户指定 Partition 的情况下，Hive 只会扫描指定 Partition 下的文件。当 Hive 运行在 `strict` 模式时，用户需要指定只要一个 Partition 字段。

Bucket 相当于目录树的叶子节点，在创建表的时候用户可以指定需要多少个 Bucket，Bucket 可以用户数据的快速采样。

由于数据都保存在 HDFS 的表空间下，如果用户需要查询 HDFS 其他目录的文件，可以使用外部表：

```
CREATE EXTERNAL TABLE test_extern(c1 string, c2 int)
LOCATION '/user/mytables/mydata';
```

外部表和普通表的唯一区别是当我们执行 `DROP TABLE` 时，外部表不会删除 HDFS 的文件。

##### SerDe

SerDe 提供了几个 Java 接口，方便在文件格式和 Java Native 类型之间相互转化。默认的 SerDe 实现叫 `LazySerDe` ，是一种用文本表示数据的存储格式。这种格式用 `Ctrl-A` 来分割列，`\n` 来分割行。其他的 SerDe 实现包括 RegexSerDe, Thrift, Avro 等等。

##### File Formats

Hadoop 上的文件可以以不同格式存储，Hive 默认的存储格式是一种叫 TextFormat 的格式，用类似 CSV 的纯文本表示数据。Format 可以在创建表的时候指定：

```
CREATE TABLE dest1(key INT, value STRING)
  STORED AS
    INPUTFORMAT 'org.apache.hadoop.mapred.SequenceFileInputFormat'
    OUTPUTFORMAT 'org.apache.hadoop.mapred.SequenceFileOutputFormat';
```

存储格式可以根据自己的需求扩展，选择合适的存储格式有利于提高性能，比如面向列存储的 ParquetFile 和 ORCFile，可以减少读取的数据量，ORCFile 甚至可以做一些与计算，来满足 Push Down 的需求。

##### 系统架构和组件

Hive 由下面的组件构成：

* MetaStore - 存储系统目录看，还有数据库，表，列的各种原信息
* Driver - 管理 HiveQL 的生命周期
* Query Compiler - 将 Hive 的语句转换成一个 MapReduce 表达的 DAG
* Execution Engine - 将任务按照依赖顺序执行，早起版本只有 MapReduce，新版本应该有 Tez 和 Spark
* HiveServer - 提供 JDBC/ODBS 接口的服务，方便和其他系统集成
* Clients - Web UI 和命令行工具

A. MetaStore

Hive 的 MetaStore 一般基于一个 RDBMS 来实现，提供了一个 ORM 层来作为数据库的抽象。MetaStore 本身不是为了高并发和高可用设计的，在架构中也是一个单点（新版本有主从了），所以 Hive 在设计的时候需要保证在任务执行期间没有任何对 MetaStore 的访问。

B. Query Compiler

Query Compiler 首先将 HQL 转换成一个 AST，然后进行类型检查和语法分析，将 AST 转换成一个 operator DAG （QB Tree），然后优化器对 QB Tree 进行优化。Hive 只支持基于规则的优化器，比如只读取指定列的数据减少 IO，或者用户指定分区字段时，只读取指定分区下的文件。
RBO 本质上是一个 Transformer，在 QB Tree 上做一系列的变换来减少查询的代价

> Hive 0.1.4 开始引入了一些基于代价的优化器（CBO）。[COST BASED OPTIMIZER](https://zh.hortonworks.com/blog/hive-0-14-cost-based-optimizer-cbo-technical-overview/)

之后就根据优化后的 QB Tree 生成物理执行计划，并且将 jar 包写入到 HDFS 的临时目录，开始运行。

C. Execution Engine

执行引擎会解析 plan.xml ，然后按照顺序将任务提交到 Hadoop，最终的数据库文件也会 move 到 HDFS 的指定目录。

