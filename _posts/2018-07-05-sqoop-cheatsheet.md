---
title: Sqoop 使用指南
---

# {{ page.title }}

Sqoop 是一个数据同步工具，用于关系型数据库和各种大数据存储比如 Hive 之间的数据相互同步。Sqoop 因为它的使用便利得到了广泛使用。类似的工具还有阿里开源的 [DataX](https://github.com/alibaba/DataX) 和其他商业工具。

[Sqoop 2.0](http://sqoop.apache.org/docs/1.99.7/index.html) 主要解决 Sqoop 1.x 扩展难的问题，提出的 Server-Client 模型，具体用的不是特别多。本文主要介绍的还是 Sqoop 1.x，最新的 Sqoop 版本是 1.4.7

### 安装

Sqoop 安装需要依赖 Hadoop 和 Hive，以 Debain 为例，安装 Sqoop 也比较简单。

```bash
apt-get install hadoop hive hive-hbase hive-hcatalog sqoop
```

除此之外，针对不同的数据源，需要不同的 JDBC Driver，这个是 Sqoop 默认没有自带的库，需要自行安装。比如 MySQL 的 Driver 是 `mysql-connector-java-5.1.13-bin.jar` ，确保 Jar 包在 Sqoop 的 classpath 内就行。

### 数据源

Sqoop 支持非常多的数据源，理论上所有支持 JDBC 的数据源都可以作为 Sqoop 的数据源。最常见的场景还是从关系型数据（RDBMS）导入到 Hive, HBase 或者 HDFS。

Sqoop 的扩展性没有想象中的那么好，但是因为大部分企业的数据仓库还是构建在传统的 Hive 和 HBase 之上的，Sqoop 还是可以满足 80% 的数据同步需求的。

一个简单以 MySQL 作为上游数据源的同步：

```bash
sqoop import --connect jdbc:mysql://database.example.com/employees \
  --username dbuser --password "" 
```

Sqoop 支持将数据同步到 HDFS 或者直接到 Hive：

```bash
sqoop import --connect jdbc:mysql://database.example.com/employees \
  --username dbuser --password "" --table employees \
  --hive-import --hive-overwrite \
  --hive-database employees --hive-table employees
```

### 存储格式

存储格式主要是 Hive 的概念，但是对于数据同步来讲，格式的选择会影响同步数据，类型系统的兼容性等等，我们必须予以关注。参考下面的表格：

|  | 压缩比 | 预计算 | 类型兼容性 |
| --- | --- | --- | --- |
| TextFile | 无 | 否 | 一般 |
| SequenceFile | 中 | 否 | 一般 |
| Parquet | 高 | 是（sqoop 依赖的版本 feature 不完整） | 好 |
| ORC | 高 | 是 | 好 | file

Hive 默认的存储格式是 TextFile，TextFile 类似一个 CSV 文件，使用不可见服务分割列，同步后的数据可读性比较好。但是因为所有数据都是按文本存储的，对于某些类型（比如 blob/bit ）无法支持。

Parquet/ORC 都是列式存储格式，这里不多介绍。在生产环境中更倾向于选择 Parquet/ORC ，节省空间的同时在 Hive 上的查询速度也更快。

同步为 Parquet 格式：

```bash
sqoop import --connect jdbc:mysql://database.example.com/employees \
 --username dbuser --password "" --table employees \
 --hive-import --hive-overwrite \
 --hive-database employees --hive-table employees \
 --as-parquetfile
```

如果要导出为 ORC 格式，需要借助 Hive 提供的一个组件 HCatalog，同步语法也稍稍不太一样

```bash
sqoop import --connect jdbc:mysql://database.example.com/employees \
 --username dbuser --password "" --table employees \
 --drop-and-create-hcatalog-table \
 --hcatalog-database employees --hcatalog-table employees \
 --hcatalog-storage-stanza "STORED AS ORC"
```

Parquet 理论上也可以通过这种方式同步，不过实测当前 Sqoop 版本 (1.4.7) 还是有 BUG，还是等等吧。

### 类型的兼容性

由于数据源支持的类型和 Hive 本身可能不太一样，所以必然存在类型转换的问题。实际在使用过程中也是非常头疼的一件事。对于 Hive 来说，支持的类型取决于采用的存储格式。以 MySQL 为例，当存储格式为 Hive 时，基本的类型映射如下：

```
MySQL(bigint) --> Hive(bigint) 
MySQL(tinyint) --> Hive(tinyint) 
MySQL(int) --> Hive(int) 
MySQL(double) --> Hive(double) 
MySQL(bit) --> Hive(boolean) 
MySQL(varchar) --> Hive(string) 
MySQL(decimal) --> Hive(double) 
MySQL(date/timestamp) --> Hive(string)
```

这里的类型映射并不完全准确，因为还取决于目标存储格式支持的类型。

由于 Text 格式非常类似 CSV，使用文本存储所有数据，对于 `Binary/Blob` 这样的类型就无法支持。Parquet/ORC/Avro 因为引入了序列化协议，本身存储是基于二进制的，所以可以支持绝大部分类型。

如果你在使用 TextFile 需要注意下面的问题：

* 上游数据源中的 `NULL` 会被转化为字符串的 `NULL`, Hive 中的 `NULL` 用 `\N` 表示
* 如果内容中含有换行符，同步到 Hive 中会被当做独立的两行来处理，造成查询结果和实际数据不相符

处理方法比较简单

如果在使用 Parquet，要注意 Sqoop 自带的 Parquet 库版本比较旧，不支持 DateTime/Timestamp 类型的数据，而是会用一个表示 ms 的 BIGINT 来代替，分析数据的时候应该注意这点。


### 数据校验

Sqoop 内建有 validate 机制，只能验证单表的 row count: [Sqoop User Guide (v1.4.3)](https://sqoop.apache.org/docs/1.4.3/SqoopUserGuide.html#validation)

### 增量导入

对于数据量很大的库，全量同步会非常痛，但是如果可以选择还是尽可能的选择全量同步，这种同步模式对数据一致性的保证最好，没有状态。如果不得不进行增量同步，可以继续往后看。

增量导入对业务是有一定侵入的，Schema 的设计和数据写入模式需要遵守一定的规范：

* 增量同步表，最好有一个 Primary Key ，最好是单调递增的 ID
* 数据的写入模式满足下面两种情形之一
    - （Append）表的内容类似日志，一次写入不做修改和删除
    - （LastModified）表的内容有修改和删除，但是删除操作是逻辑删除，比如用 `is_deleted` 字段标识，并且有一个最后更新的时间戳比如 `updated_at`，`updated_at` 上有索引。

增量的数据同步大致分为 2 个阶段：读取增量数据和合并数据。对 Sqoop 来说，增量同步需要 [sqoop-metastore](http://sqoop.apache.org/docs/1.4.7/SqoopUserGuide.html#_literal_sqoop_metastore_literal) 的支持，用于保存上次同步的位置。

比如对于 Append 模式，假设我们有一张表叫 `employees`，Primary Key 是 `id`，上一次同步到 `id <= 10000` 的数据：

```bash 
sqoop import --connect jdbc:mysql://database.example.com/employees \
  --username dbuser --password "" --table employees \
  --target-dir <path/to/hive/table/location> \
  --incremental append --check-column id --last-value 10000
```

我们直接将数据 load 到了 Hive 的表空间里，Hive 可以直接查询到最新增量的数据。
对 LastModified 模式会稍微复杂一些，除了加载增量数据，还涉及数据合并的问题，这里唯一的主键就特别重要了。

```bash
sqoop import --connect jdbc:mysql://database.example.com/employees \
  --username dbuser --password "" --table employees \
  --target-dir <path/to/hive/table/location> \
  --incremental lastmodified --check-column updated_at --last-value '2018-07-05 00:00:00'
```

Sqoop 会在同步结束后再启动一个 merge 任务对数据去重，如果表太小，可能 merge 的代价比全量同步的还要高，我们就要慎重考虑全量同步是不是值得了。

> 由于 HDFS 不支持修改文件，sqoop 的 `--incremental` 和 `--hive-import` 不能同时使用

Sqoop 也提供了单独的 `sqoop merge` 工具，我们也可以分开进行 import 和 merge 这两个步骤。

### 加速同步

这个小节讨论一下如何加快 Sqoop 的同步速度，Sqoop 同步速度大致取决于下面的几个因素：

* 数据源的读取速度
* HDFS 写入速度
* 数据倾斜程度

##### 数据源的读取速度

如果上游数据源是 MySQL，可以考虑更换 SSD，保证 MySQL 实例的负载不要太高。除此之外，Sqoop 可以通过参数控制并发读取的 Mapper 个数加快读取速度。

```bash
sqoop -m <mapper_num> ......
``` 

注意 `-m` 并不是越大越高，并发数过高会把数据库实例打死，同步速度反而变慢。

Sqoop 默认会通过 jdbc 的 API 来读取数据，但是可以通过参数控制使用 MySQL 自己的 `mysqldump` 来导出数据，这种方式比 jdbc 快一些，缺点是你不能选择要同步的列。另外只能支持目标格式为 Textfile。比较局限但是特定情况下还是很好使的。

##### HDFS 写入速度

这个除了刚刚提供的控制并发数，还需要保证 Yarn 分配给 Sqoop 的资源充足，不要让资源成为同步的瓶颈。另外，当我们选择 Parquet/ORC 作为存储格式时，数据在写入的时候需要做大量的预计算，这个过程是比较消耗 CPU 和内存的，我们可以控制 MapReduce 参数，适当提高 Sqoop 的资源配额。

```bash
sqoop -Dmapreduce.map.cpu.vcores=4 -Dmapreduce.map.memory.mb=8192 ...
```

##### 数据倾斜

Sqoop 默认的导入策略是根据主键进行分区导入的，具体的并发粒度取决于 `-m` 参数。如果主键不连续出现大幅度跳跃，就会导致 Sqoop 导入的时候出现严重的数据倾斜。比如某张表的主键分布是这样的：

```
1
2
3
...
1000
1001
100000
100001
```

Sqoop 计算每个 Mapper 读取的数据范围的时候，会遵循很简单的公式计算：

```
range = (max(pk) - min(pk)) / mapper
```

几乎出现所有的数据 load 都集中在第一个 mapper 上，整体同步相当于没有并发。

参考阅读：

* [Hive 数据倾斜 (Data Skew) 总结 - CSDN博客](https://blog.csdn.net/mike_h/article/details/50148309)
* [Avoiding Data Skew in Sqoop](http://abhinaysandeboina.blogspot.hk/2017/08/avoiding-data-skew-in-sqoop.html)
* [Sqoop 指南 — QingCloud  文档](https://docs.qingcloud.com/guide/sqoop.html)

### 导出

Sqoop 支持将 Hive 的数据导出到 MySQL，方便在线系统调用。

```
sqoop export --connect jdbc:mysql://database.example.com/employees --table employees --username dbuser --password "" --relaxed-isolation --update-key id --update-mode allowinsert --hcatalog-database employees --hcatalog-table employees
```

借助 HCatalog 可以比较轻松的将 Hive 表的数据直接导出到 MySQL。更多的详情参考官方文档，这里不多介绍。

### 更进一步

如果我们要同步的数据非常多，管理同步任务本身就变成了一件复杂的事情。我们不仅要考虑源数据库的负载，安全性。还要考虑同步任务的启动时间，Schema 变更等等问题。实际使用的时候，我们在内部自研了一个平台，管理 MySQL 和 Hive 的数据源并对 Sqoop 任务做了调度。有一部分功能在 Sqoop 2.0 已经实现了。在大规模使用 sqoop 一定要想清楚运维的问题。

### Reference

* [hadoop - Not able to run sqoop using oozie - Stack Overflow](https://stackoverflow.com/questions/24987820/not-able-to-run-sqoop-using-oozie)
* [mysql - how to deal with sqoop import delimiter issues \r\n - Stack Overflow](https://stackoverflow.com/questions/23250977/how-to-deal-with-sqoop-import-delimiter-issues-r-n)
* [使用Sqoop从MySQL导入数据到Hive和HBase 及近期感悟 - 作业部落 Cmd Markdown 编辑阅读器](https://www.zybuluo.com/aitanjupt/note/209968)
* [Can sqoop be used to directly import data into an ORC table? - Hortonworks](https://community.hortonworks.com/questions/28060/can-sqoop-be-used-to-directly-import-data-into-an.html)
* [LanguageManual ORC - Apache Hive - Apache Software Foundation](https://cwiki.apache.org/confluence/display/Hive/LanguageManual+ORC)
* Hive 增量同步： [Four-step Strategy for Incremental Updates in Apache Hive](https://hortonworks.com/blog/four-step-strategy-incremental-updates-hive/)
* 使用 MERGE INTO 更新 Hive 数据： [Update Hive Tables the Easy Way - Hortonworks](https://hortonworks.com/blog/update-hive-tables-easy-way/)
* SQL MERGE 的性能： [Apache Hive: Moving Beyond Analytics Offload with SQL MERGE - Hortonworks](https://hortonworks.com/blog/apache-hive-moving-beyond-analytics-offload-with-sql-merge/)
* [sqoop incremental import in hive I get error message hive not support append mode how to solve that - Hortonworks](https://community.hortonworks.com/questions/11373/sqoop-incremental-import-in-hive-i-get-error-messa.html)
* [Sqoop Incremental Import | MySQL to Hive | Big Data & Hadoop](http://www.hadooptechs.com/sqoop/sqoop-incremental-import-mysql-to-hive)
* [Sqoop 1.4.6 导入实战 (RDB含MySQL和Oracle) - 天善智能：专注于商业智能BI和数据分析、大数据领域的垂直社区平台](https://ask.hellobi.com/blog/marsj/4114)

