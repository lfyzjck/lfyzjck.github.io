var store = [{
        "title": "Golang依赖管理实践",
        "excerpt":"Golang依赖管理实践 引子 这篇文章似乎拖得有点久了，好在现在在写了。Golang 的风潮尚未过去，大红大紫的 Docker 进一步提高了人们对这门语言的期待，但是当你把 Golang 用在线上生产环境的时候，就会面临一个比较严重问题：依赖管理。 对于依赖管理，Java 有 Maven，Python 有 pip，Nodejs 也有 npm，Golang 自己本身作为一种编译型的语言，依赖管理只能靠官方提供的 go-get 工具，大部分情况下，这个工具对我们在开发时还是相当友好的。 go get 简介 go-get是 Golang 自带的一个依赖管理工具，他可以从远程下载你需要的包，但是注意Golang并没有统一的仓库，所以你传给 go get 的参数其实是一个URL。对于 Github, Google Code, Bitbucket 这样的网站，go get 可以自动解析到 repo 地址，典型的 go get 大概会包含下面几个步骤： fetch repo 到本地的 $GOPATH/src 下, 此过程会依赖 repo 对应版本管理软件，比如你要安装一个 Github 上的包，那么你本地必须安装了 git...","categories": [],
        "tags": [],
        "url": "/2015/12/21/golang-deps-practice.html",
        "teaser": null
      },{
        "title": "ioutil.ReadAll 引发的内存泄露",
        "excerpt":"ioutil.ReadAll 引发的内存泄露 最近线上的一个计数服务突然出现内存不足的情况，服务器 4G 的内存会在几分钟内被耗尽。计数服务是兼容 Redis Protocol 的，多方查找，最终确定问题出在 Redis Protocol 的解析上面。协议解析的实现部分借鉴了 docker/go-redis-server 。 简化的代码如下： // parse redis protocol from bufio.Reader func parse(r *bufio.Reader) ([][]byte, error) { line, err := r.ReadString('\\n') var argsCount int if line[0] == '*' { fmt.Sscanf(line, \"*%d\\r\", &amp;argsCount) } args := make([][]byte, argsCount, argsCount) for i :=...","categories": [],
        "tags": [],
        "url": "/2015/12/21/golang-ioutils-memleak.html",
        "teaser": null
      },{
        "title": "Golang编程风格不完全指南",
        "excerpt":"Golang编程风格不完全指南 语言规范 简介 学习Go规范的最好办法就是看Go的源码，官方是这么说的 格式化 格式这个东西，对大部分语言来说都挺重要的，不过Go有个很牛逼的工具叫gofmt，可以从package级别对代码的格式进行格式化，所以这种脏活就交给工具来做吧。 注释 Go提供了C-style的/* */的块注释，和C++-style的// 行内注释 对于每个package，都应当提供响应的注释，如果这个package提供的功能很简单，那么用行内注释写一些简单的说明也是可以的。不必在块注释的每行前都加上*号，注释内的字体可能不是等宽字体，所以也不要依赖空格来对齐，godoc会帮你完成这些事情。 在一个package中，每个被export的方法，都应该包含注释.注释最好以方法名开头，然后用最简单的一句话概括这个函数的用途。 命名 Go推荐采用类似Java的驼峰式的命名，而不是用下划线。 Package names 包名应该尽量简洁且容易记忆，处于习惯一般采用全部小写字母。每一个使用你提供的Package的用户，都需要提前import，所以你也不用特地的检测名字的冲突，万一不行还可以在本地使用别的名字代替。 Getter&amp;Setter GetAttr就命名成Attr() SetAttr还是保持SetAttr() 然后注意首字母大写，确保这个函数是被export的 Interface 一般就是加个er的后缀，比如Reader, Writer, Notifer 循环结构 Go的循环类似于C，稍有不同。Go统一了for和while，而且没有do-while // Like a C for for init; condition; post { } // Like a C while for condition { } // Like a...","categories": [],
        "tags": [],
        "url": "/2015/12/21/golang-programming-style.html",
        "teaser": null
      },{
        "title": "Elixir Overview",
        "excerpt":"elixir-overview 初窥 Elixir Elixir 是基于 Erlang VM 开发一个新语言，继承了 Erlang 的很多有点，在保持和 Erlang ByteCode 兼容的提前下提供了非常简洁易懂的语法。单从语法层面可能和 Ruby 比较像，不过仔细看还是和 Erlang 有很多一致的地方，如果你不习惯 Erlang 奇怪的语法(其实看过 Prolog 的语法以后就不觉得 Erlang 奇怪了)，但是又想享受 Erlang/OTP 带来的各种好处，Elixir 是不错的选择。 Elixir 可以调用 Erlang 的标准库，如果基本不用担心 第三方库不足的问题， Erlang 几十年的积累在这里放着呢，难怪 Joe Armstrong 大叔也对 Elixir 赞不绝口。 类型 用 iex 来启动的 Elixir Shell，可以看到一个很像 Erlang Shell 的东西： $ iex Erlang/OTP...","categories": [],
        "tags": [],
        "url": "/2016/03/04/elixir-overview.html",
        "teaser": null
      },{
        "title": "Graphviz Quick Start",
        "excerpt":"Graphviz 入门指南 Graphviz 是一个开源的图可视化工具，非常适合绘制结构化的图标和网络。Graphviz 使用一种叫 DOT 的语言来表示图形。 DOT 语言 DOT 语言是一种图形描述语言。能够以简单的方式描述图形，并且为人和计算机所理解。 无向图 graph graphname { a -- b -- c; b -- d; } 有向图 digraph graphname { a -&gt; b -&gt; c; b -&gt; d; } 设置属性 属性可以设置在节点和边上，用一对 [] 表示，多个属性可以用空格或者 , 隔开。 strict graph { // 设置节点属性 b [shape=box];...","categories": [],
        "tags": [],
        "url": "/2016/08/03/graphviz-quick-start.html",
        "teaser": null
      },{
        "title": "金丝雀发布",
        "excerpt":"金丝雀发布 金丝雀部署（Canary Deployments）在知乎落地差不多一年时间，通过金丝雀避免了很多线上的问题，相比之前的发布模型，极大降低了部署的风险。知乎是非常推崇 Devops 的公司，金丝雀发布作为 Devops 一种实践自然不会落下。但是由于基础设施变得越来越抽象和复杂，理解整个部署的工作流程已经变得比较困难，正好有机会给新的同事科普一下金丝雀发布的架构。 相传上个世纪煤矿工人在作业时，为了避免瓦斯中毒会随身带一只金丝雀下到矿洞，由于金丝雀对二氧化碳非常敏感，所以看到金丝雀昏厥的时候矿工们就知道该逃生了。[1] 金丝雀发布就是用生产环境一小部分流量验证应用的一种方法。从这个名字的由来也可以看到，金丝雀发布并不是完美的，如果代码出现问题，那么背用作测试的小部分流量会出错，就跟矿坑中昏厥的金丝雀一样。这种做法在非常敏感的业务中几乎无法接受，但是当系统复杂的到一定程度，错误无法完全避免的时候，为了避免出现更大的问题，牺牲一小部分流量，就可以将大部分错误的影响控制在一定范围内。 金丝雀发布的步骤 一个典型的金丝雀发布大概包含以下步骤[2]： 准备好发布用的 artifact 从负载均衡器上移除金丝雀服务器 升级金丝雀服务器 最应用进行自动化测试 将金丝雀服务器加入到负载均衡列表中 升级剩余的服务版本 在知乎，负载均衡器采用的 HAProxy，并且依赖 Consul 作服务注册发现。而服务器可能是一台物理机也可能是 bay 上一个抽象的容器组。 对于物理机，我们可以单独为其配置一个一台独立的服务器，通过在 HAProxy 上设置不同于 Production 服务器的权重来控制测试流量。但是这种方法不够方便，做自动化也难一些 对于容器相对简单，我们复制一个 Production 版本的容器组，然后通过控制 Production 和 Canary 容器组的数量就可以控制流量。 整个过程是部署系统在中间协调，当我们上线发布完成，部署系统会移除金丝雀服务器，让应用回到 Normal 状态。 如果遇到问题需要回滚，只需要将金丝雀容器组从 HAProxy 上摘掉就可以，基本上可以在几秒内完成。 HAProxy 在整个金丝雀发布的架构中，HAProxy 是非常重要的一个组件，要发现后端的服务地址，并动态控制金丝雀和线上的流量比例。部署时我们并不会直接操作 HAProxy，而是更新 Consul 上的注册信息，通过事件广播告诉 HAProxy 服务地址有变化，这一过程通过...","categories": [],
        "tags": [],
        "url": "/2016/12/05/canary-deployment.html",
        "teaser": null
      },{
        "title": "Hive 论文笔记",
        "excerpt":"Hive 论文笔记 MapReduce 出现后，对数据的计算需求越来越多，而 MapReduce 提供的 API 太底层，学习成本和开发成本比较高，因此需要一个类 SQL 的工具，来代替大部分的 MapReduce 的使用场景。 数据模型，类型系统和查询语言 Hive 和传统的数据库一样有 Database 和 Table 的概念，数据存储在 Table 中。每个 Table 中会会很多行，每行有多列组成。 类型 Hive 支持原生类型 (primitive types) 和复杂类型 (complex types)。 Primitive: Integers: bigint, int, smallint, tinyint Float: float, double String Complex: map&lt;key-type, value-type&gt; list struct&lt;field-name, field-type, …&gt; SerDe ,...","categories": [],
        "tags": [],
        "url": "/2017/11/03/hive-paper.html",
        "teaser": null
      },{
        "title": "使用 BigTop 打包 Hadoop 全家桶",
        "excerpt":"使用 BigTop 打包 Hadoop 全家桶 使用 Hadoop 软件好像难免会自己改下代码做些定制，或者在部分组件的版本选择上激进，其他的版本( 比如 HDFS) 上保守。最近在公司升级 Hive 到 2.1.1 ，也对代码做了一些调整确保对业务的兼容性，之前公司使用的是 hive-1.2.2-cdh-5.5.0 。cdh 的发布节奏太慢跟不上社区的节奏，而且截止到现在，社区版本的 BUG 数量和稳定性都可以接受而不是必须选择商业公司给我们提供的发行版。 公司用的服务器是 Debian 7/8，为了方便的把定制过的 Hive 部署到服务器，需要将 Hive 打包成 deb，一直没找到特别好的打包方法。要做到 Cloudera 那样规范的 deb 非常繁琐，要处理启动脚本，环境变量，配置文件的 alternatives 等等。顺着这个思路找到了 Cloudera 官方的打包工具 cdh-package ，但是这个库已经太长时间没有维护了，里面依赖的版本信息非常老旧，而且自己测试也没运行成功。但是 cdh-package 是基于 BigTop 的，BigTop 本身的维护还不错。 Bigtop 非常有野心，它的主要目标就是构建一个 Apache Hadoop 生态系统的包和交互式测试的社区。这个包括对各类不同级别工程进行测试(包，平台，运行时间，升级等…)，它由社区以关注系统作为一个整体开发而来。BigTop 官方除了介绍怎么安装之外没有任何使用文档，不过研究以后发现还算简单，不需要太多的说明。 准备...","categories": [],
        "tags": [],
        "url": "/2018/02/25/bigtop-usage.html",
        "teaser": null
      },{
        "title": "Sqoop 使用指南",
        "excerpt":"Sqoop 使用指南 Sqoop 是一个数据同步工具，用于关系型数据库和各种大数据存储比如 Hive 之间的数据相互同步。Sqoop 因为它的使用便利得到了广泛使用。类似的工具还有阿里开源的 DataX 和其他商业工具。 Sqoop 2.0 主要解决 Sqoop 1.x 扩展难的问题，提出的 Server-Client 模型，具体用的不是特别多。本文主要介绍的还是 Sqoop 1.x，最新的 Sqoop 版本是 1.4.7 安装 Sqoop 安装需要依赖 Hadoop 和 Hive，以 Debain 为例，安装 Sqoop 也比较简单。 apt-get install hadoop hive hive-hbase hive-hcatalog sqoop 除此之外，针对不同的数据源，需要不同的 JDBC Driver，这个是 Sqoop 默认没有自带的库，需要自行安装。比如 MySQL 的 Driver 是 mysql-connector-java-5.1.13-bin.jar ，确保...","categories": [],
        "tags": [],
        "url": "/2018/07/05/sqoop-cheatsheet.html",
        "teaser": null
      },{
        "title": "大数据平台的数据同步服务实践",
        "excerpt":"大数据平台的数据同步服务实践 引言 在大数据系统中，我们往往无法直接对在线系统中的数据直接进行检索和计算。在线系统所使用关系型数据库，缓存存储数据的方式都非常不同，很多系统不适合 OLAP 式的查询，也不允许 OLAP 查询影响到在线业务的稳定性。从数仓建设的角度思考，稳定规范的数仓必定依赖于稳定和规范的数据源，数据需要经过采集加工后才能真正被数仓所使用。推动数据同步服务的平台化，才有可能从源头规范数据的产出。数据同步服务不像数据挖掘一样可以直接产生价值，但它更像是连接不同存储的高速公路，好的同步工具可以很大程度上提升数据开发的效率。 本文主要介绍知乎在数据同步这方面的建设，工具选型和平台化的实践。 业务场景及架构 在线业务的数据库在知乎内部还是以 MySQL 和 HBase 为主，所以数据源方面主要考虑 MySQL 和 Hive 的互相同步，后续可以支持 HBase。早期数据同步使用 Oozie + Sqoop 来完成，基本满足业务需求。但是随着数仓任务不断变多，出现了很多重复同步的例子，对同步任务的负载管理也是空白。凌晨同步数据导致 MySQL 不断报警，DBA 苦不堪言。对于业务来说，哪些表已经被同步了，哪些表还没有也是一个黑盒子，依赖其他业务方的数据都只能靠口头的约定。为了解决这些问题，决定对数据同步做一个统一的平台，简化同步任务的配置，调度平衡负载，管理元信息等等。 技术选型 数据同步工具市面上有很多解决方案，面向批的主要有 Apache Sqoop 和阿里开源的 DataX，下面主要对比这两种数据同步工具。 Sqoop Pros： 基于 MapReduce 实现，容易并行和利用现有集群的计算资源 和 Hive 兼容性好，支持 Parquet，ORC 等格式 支持自动迁移 Schema 社区强大，遇到的问题容易解决 Cons： 支持的数据源不算太丰富（比如 ES），扩展难度大 不支持限速，容易对 MySQL...","categories": [],
        "tags": [],
        "url": "/2018/11/14/datasync-practice-in-zhihu.html",
        "teaser": null
      },{
        "title": "Hive 锁机制",
        "excerpt":"Hive 锁机制 背景 Hive 锁机制是为了让 Hive 支持并发读写而设计的 feature，另外要解决并发读写的情况下”脏读“ （Read uncommited）的问题。脏读的问题本身通过实现了原子的 reader/writer 已经得到解决（https://issues.apache.org/jira/browse/HIVE-829）和锁机制并不绑定。 锁机制 Hive 内部定义了两种类型的锁： 共享锁(Share) 互斥锁(Exclusive) 不同锁之间的兼容性入下面表格： Lock Compatibility Existing Lock（S） Existing Lock（X） Requested Lock（S） True False Requested Lock（X） False False 锁的基本机制是： 元信息和数据的变更需要互斥锁 数据的读取需要共享锁 根据这个机制，Hive 的一些场景操作对应的锁级别如下： Hive command Locks Acquired select .. T1 partition P1 S on T1, T1.P1 insert into...","categories": [],
        "tags": [],
        "url": "/2019/09/10/hive-locks.html",
        "teaser": null
      },{
        "title": "Ansible 快速入门",
        "excerpt":"Ansible 快速入门 Ansible 是一个 IT 自动化软件，类似于 Puppet 和 Chef，是实现 Infra-as-a-code 的一种工具。 QuickStart 理解 Ansible 如何控制远程服务器 Ansible 的所有操作是基于 ssh 协议的，我们可以通过 ssh 命令在远程服务器上执行命令： $ ssh root@ip 'ping baidu.com' PING baidu.com (39.156.69.79) 56(84) bytes of data. 64 bytes from 39.156.69.79 (39.156.69.79): icmp_seq=1 ttl=48 time=7.83 ms 64 bytes from 39.156.69.79 (39.156.69.79): icmp_seq=2 ttl=48 time=3.43...","categories": [],
        "tags": [],
        "url": "/2020/06/07/ansible-quick-start.html",
        "teaser": null
      },{
        "title": "RocksDB Java API Notice",
        "excerpt":"RocksDB Java API Notice 最近实现的一个日志收集的服务使用了 RocksDB，项目由 Java 实现所以使用了 rocksdbjni。网上关于 RocksDB Java 客户端的资料，除了官网 Wiki 以外意外的非常少。在这个过程中踩了非常多的坑，总结一下，希望能帮到一样在 RocksDB Java 客户端挣扎的人。 JNI 简介 JNI 是 JVM 调用原生（Native）C/C++ 的规范。在遇到 Java 无法解决的某些场景时会非常有用：比如某些平台相关的库或者接口。JNI 允许在 Native 方法创建或者使用 Java 的对象提供的方法。 Try-with-resource 由于 JNI 产生的对象本质上的 Native 对象，JVM 自己并不知道 C/C++ 的堆，这些 Native 对象都是堆 GC 不可见的，也无法被 GC 回收。在 RocksJava 中，所有的 Object 都继承自...","categories": [],
        "tags": [],
        "url": "/2021/03/13/rocksdb-jni-api-notice.html",
        "teaser": null
      }]
