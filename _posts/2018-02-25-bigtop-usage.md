---
title: 使用 BigTop 打包 Hadoop 全家桶
---

# {{ page.title }}

使用 Hadoop 软件好像难免会自己改下代码做些定制，或者在部分组件的版本选择上激进，其他的版本( 比如 HDFS)  上保守。最近在公司升级 Hive 到 2.1.1 ，也对代码做了一些调整确保对业务的兼容性，之前公司使用的是 `hive-1.2.2-cdh-5.5.0` 。cdh 的发布节奏太慢跟不上社区的节奏，而且截止到现在，社区版本的 BUG 数量和稳定性都可以接受而不是必须选择商业公司给我们提供的发行版。

公司用的服务器是 Debian 7/8，为了方便的把定制过的 Hive 部署到服务器，需要将 Hive 打包成 deb，一直没找到特别好的打包方法。要做到 Cloudera 那样规范的 deb 非常繁琐，要处理启动脚本，环境变量，配置文件的 alternatives 等等。顺着这个思路找到了 Cloudera 官方的打包工具 [cdh-package](https://github.com/cloudera/cdh-package) ，但是这个库已经太长时间没有维护了，里面依赖的版本信息非常老旧，而且自己测试也没运行成功。但是 cdh-package 是基于 [BigTop](https://github.com/apache/bigtop) 的，BigTop 本身的维护还不错。

Bigtop 非常有野心，它的主要目标就是构建一个 Apache Hadoop 生态系统的包和交互式测试的社区。这个包括对各类不同级别工程进行测试(包，平台，运行时间，升级等...)，它由社区以关注系统作为一个整体开发而来。BigTop 官方除了介绍怎么安装之外没有任何使用文档，不过研究以后发现还算简单，不需要太多的说明。

### 准备 BigTop 环境

可以根据官方的说明来安装，我这里是直接从 Github 拉了代码：

```bash
git clone https://github.com/apache/bigtop.git
cd bigtop
git checkout release-1.2.1
./gradlew
```

然后我们可以运行 `./gradlew tasks` 看下 BigTop 给我们提供的命令，命令遵循下面的格式 `./gradlew <package>-<dist>` ：

```bash
$ ./gradlew tasks
# hide some output
hive-clean - Removing hive component build and output directories
hive-deb - Building DEB for hive artifacts
hive-download - Download hive artifacts
hive-help - List of available tasks for hive
hive-info - Info about hive component build
hive-pkg - Invoking a native binary packaging target deb
hive-relnotes - Preparing release notes for hive. No yet implemented!!!
hive-rpm - Building RPM for hive artifacts
hive-sdeb - Building SDEB for hive artifacts
hive-spkg - Invoking a native binary packaging target sdeb
hive-srpm - Building SRPM for hive artifacts
hive-tar - Preparing a tarball for hive artifacts
hive-version - Show version of hive component
```

然后编辑 `bigtop.bom` 将依赖的版本改成自己需要的版本，注意 BigTop 这里会优先使用 bigtop.bom 中定义的版本号覆盖源代码的版本号。

```json
'hive' {
      name    = 'hive'
      relNotes = 'Apache Hive'
      version { base = '1.2.1'; pkg = base; release = 1 }
      tarball { destination = "apache-${name}-${version.base}-src.tar.gz"
                source      = destination }
      url     { download_path = "/$name/$name-${version.base}/"
                site = "${apache.APACHE_MIRROR}/${download_path}"
                archive = "${apache.APACHE_ARCHIVE}/${download_path}" }
    }
```

下面将介绍如何用 BigTop 打包 Hive

### 用 BigTop 打包 Hive

我们的目标是将一份修改过的 Hive 代码打包成 deb 包分发到集群，首先在编辑机器上准备一些必要的依赖：

```bash
sudo apt-get update
sudo apt-get install devscripts
sudo apt-get install dh-make
```

接下来准备 Hive 的代码，Bigtop 默认根据 bom 文件里指定的版本号从上游下载 Hive 的代码，解压然后编译。但是由于我们要使用自己修改过的版本，可以修改 `bigtop.bom` 从内部 git 仓库下载代码。

```grovvy
  'hive' {
      name    = 'hive'
      relNotes = 'Apache Hive'
      version { base = '2.1.1'; pkg = base; release = 1 }
      tarball { destination = "apache-${name}-${version.base}-src.tar.gz"
                source      = destination }
      git     { repo = "https://exmaple.com:hive/hive"
                ref = "release-2.1.1"
                dir  = "${name}-${version.base}" }
    }
```

然后就可以开始打包了：

```bash
./gradlew hive-deb
```

注意 BigTop 在它的仓库里包含了对 Hive 的几个 patch 文件，我这边测试的时候会导致编译失败，建议删除：

```bash
rm -f /bigtop-packages/src/common/hive/*
```

然后清理构建环境，重新打包：

```bash
./gradlew hive-clean
./gradlew hive-deb
```

如果需要更新包，可以提升 Release number，默认是 1 ，这个 BigTop 在文档里没有提及：

```bash
BIGTOP_BUILD_STAMP=<release> ./gradlew hive-deb
```

### 发布 deb 包

看看我们构建的结果，产生了很多 deb 包，这些包都需要上传到内部的 mirror

```
$ ls -l output/hive/
total 138516
-rw-r--r-- 1 ck ck 78645700 Feb  1 18:32 hive_2.1.1-1_all.deb
-rw-r--r-- 1 ck ck   314946 Feb  1 18:33 hive_2.1.1-1_amd64.build
-rw-r--r-- 1 ck ck     3461 Feb  1 18:32 hive_2.1.1-1_amd64.changes
-rw-r--r-- 1 ck ck    12500 Feb  1 18:18 hive_2.1.1-1.debian.tar.xz
-rw-r--r-- 1 ck ck     1227 Feb  1 18:18 hive_2.1.1-1.dsc
-rw-r--r-- 1 ck ck     1829 Feb  1 18:18 hive_2.1.1-1_source.changes
-rw-r--r-- 1 ck ck 20999949 Feb  1 18:18 hive_2.1.1.orig.tar.gz
-rw-r--r-- 1 ck ck   107906 Feb  1 18:32 hive-hbase_2.1.1-1_all.deb
-rw-r--r-- 1 ck ck   452862 Feb  1 18:32 hive-hcatalog_2.1.1-1_all.deb
-rw-r--r-- 1 ck ck     3632 Feb  1 18:32 hive-hcatalog-server_2.1.1-1_all.deb
-rw-r--r-- 1 ck ck 39029552 Feb  1 18:32 hive-jdbc_2.1.1-1_all.deb
-rw-r--r-- 1 ck ck     3734 Feb  1 18:32 hive-metastore_2.1.1-1_all.deb
-rw-r--r-- 1 ck ck     3738 Feb  1 18:32 hive-server2_2.1.1-1_all.deb
-rw-r--r-- 1 ck ck  2068240 Feb  1 18:32 hive-webhcat_2.1.1-1_all.deb
-rw-r--r-- 1 ck ck     3608 Feb  1 18:32 hive-webhcat-server_2.1.1-1_all.deb
```

