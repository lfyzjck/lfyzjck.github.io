---
title: Hive 锁机制
---

# {{ page.title }}

## 背景

Hive 锁机制是为了让 Hive 支持并发读写而设计的 feature，另外要解决并发读写的情况下”脏读“ （Read uncommited）的问题。脏读的问题本身通过实现了原子的 reader/writer 已经得到解决（[https://issues.apache.org/jira/browse/HIVE-829](https://issues.apache.org/jira/browse/HIVE-829)）和锁机制并不绑定。

## 锁机制

Hive 内部定义了两种类型的锁：

- 共享锁(Share)
- 互斥锁(Exclusive)

不同锁之间的兼容性入下面表格：

| Lock Compatibility |Existing Lock（S）| Existing Lock（X）|
| --- | --- | --- |
| Requested Lock（S） | True | False |
| Requested Lock（X） | False | False |


锁的基本机制是：

- 元信息和数据的变更需要互斥锁
- 数据的读取需要共享锁

根据这个机制，Hive 的一些场景操作对应的锁级别如下：

| Hive command | Locks Acquired |
| --- | --- |
| select .. T1 partition P1 | S on T1, T1.P1 |
| insert into T2(partition P2) select .. T1 partition P1 | S on T2, T1, T1.P1 and X on T2.P2 |
| insert into T2(partition P.Q) select .. T1 partition P1 | S on T2, T2.P, T1, T1.P1 and X on T2.P.Q |
| alter table T1 rename T2 | X on T1 |
| alter table T1 add cols	| X on T1 |
| alter table T1 replace cols | X on T1 |
| alter table T1 change cols	| X on T1 |
| alter table T1 concatenate	| X on T1 |
| alter table T1 add partition P1 | S on T1, X on T1.P1 |
| alter table T1 drop partition P1 | S on T1, X on T1.P1 |
| alter table T1 touch partition P1 | S on T1, X on T1.P1 |
| alter table T1 set serdeproperties | S on T1 |
| alter table T1 set serializer | S on T1 |
| alter table T1 set file format | S on T1 |
| alter table T1 set tblproperties | X on T1 |
| alter table T1 partition P1 concatenate | X on T1.P1 |
| drop table T1 | X on T1 |

Hive 锁在 zookeeper 上会对应 ephemeral 的节点，避免释放锁失败导致死锁

## 调试锁🔐

可以通过下面命令查看某个表或者分区的锁

- SHOW LOCKS <TABLE_NAME>;
- SHOW LOCKS <TABLE_NAME> EXTENDED;
- SHOW LOCKS <TABLE_NAME> PARTITION (<PARTITION_DESC>);
- SHOW LOCKS <TABLE_NAME> PARTITION (<PARTITION_DESC>) EXTENDED;

See also [EXPLAIN LOCKS](https://cwiki.apache.org/confluence/display/Hive/LanguageManual+Explain#LanguageManualExplain-TheLOCKSClause).

## 关闭锁机制

可以通过设置 `hive.support.concurrency=fasle` 来解决

关闭锁机制会造成下面影响：

- 并发读写同一份数据时，读操作可能会随机失败
- 并发写操作的结果在随机出现，后完成的任务覆盖之前完成任务的结果
- SHOW LOCKS， UNLOCK TABLE 会报错

## HiveLockManager 的实现

在关闭 Hive 锁的过程中，发现粗暴的禁用 concurrency 会导致 UNLOCK TABLE 语法报错。一些遗留系统已经依赖这个语法来确保自身任务不被阻塞，这样的修改会导致这些程序出现问题。于是转而研究有没有其他简单锁的实现可以达到类似的效果。粗看 Hive 的代码找到这 3  种实现：

- DbLockManager 配合 DbTxnManager 用于在 Hive 中实现事务，不能单独使用
- EmbeddedLockManager HiveServer 级别基于内存实现的锁
- ZooKeeperHiveLockManager 默认的 LockManager 实现，基于 zookeeper 实现的分布式协调锁

## Hive Zookeeper 锁泄露问题

在 cancel Hive 查询时，有概率发生 Zookeeper 锁释放失败的问题。因为 Hive 的锁在Zookeeper 是持久节点，累计的锁释放失败可能造成 Zookeeper 的 Node 数量过多，影响 Zookeeper 的性能。社区有对应的 ISSUE，该问题在 2.3.0 版本才被 FIX: [https://issues.apache.org/jira/browse/HIVE-15997](https://issues.apache.org/jira/browse/HIVE-15997)

HiveServer 上可以发现类似日志，就是锁释放失败的标志：

    2019-03-06T07:41:56,556 ERROR [HiveServer2-Background-Pool: Thread-45399] ZooKeeperHiveLockManager: Failed to release ZooKeeper lock:
    java.lang.InterruptedException
            at java.lang.Object.wait(Native Method) ~[?:1.8.0_45]
            at java.lang.Object.wait(Object.java:502) ~[?:1.8.0_45]
            at org.apache.zookeeper.ClientCnxn.submitRequest(ClientCnxn.java:1342) ~[zookeeper-3.4.5-cdh5.5.0.jar:3.4.5-cdh5.5.0--1]
            at org.apache.zookeeper.ZooKeeper.delete(ZooKeeper.java:871) ~[zookeeper-3.4.5-cdh5.5.0.jar:3.4.5-cdh5.5.0--1]
            at org.apache.curator.framework.imps.DeleteBuilderImpl$5.call(DeleteBuilderImpl.java:239) ~[curator-framework-2.6.0.jar:?]
            at org.apache.curator.framework.imps.DeleteBuilderImpl$5.call(DeleteBuilderImpl.java:234) ~[curator-framework-2.6.0.jar:?]
            at org.apache.curator.RetryLoop.callWithRetry(RetryLoop.java:107) ~[curator-client-2.6.0.jar:?]
            at org.apache.curator.framework.imps.DeleteBuilderImpl.pathInForeground(DeleteBuilderImpl.java:230) ~[curator-framework-2.6.0.jar:?]
            at org.apache.curator.framework.imps.DeleteBuilderImpl.forPath(DeleteBuilderImpl.java:215) ~[curator-framework-2.6.0.jar:?]
            at org.apache.curator.framework.imps.DeleteBuilderImpl.forPath(DeleteBuilderImpl.java:42) ~[curator-framework-2.6.0.jar:?]
            at org.apache.hadoop.hive.ql.lockmgr.zookeeper.ZooKeeperHiveLockManager.unlockPrimitive(ZooKeeperHiveLockManager.java:474) [hive-exec-2.1.1.jar:2.1.1]
            at org.apache.hadoop.hive.ql.lockmgr.zookeeper.ZooKeeperHiveLockManager.unlockWithRetry(ZooKeeperHiveLockManager.java:452) [hive-exec-2.1.1.jar:2.1.1]
            at org.apache.hadoop.hive.ql.lockmgr.zookeeper.ZooKeeperHiveLockManager.unlock(ZooKeeperHiveLockManager.java:440) [hive-exec-2.1.1.jar:2.1.1]
            at org.apache.hadoop.hive.ql.lockmgr.zookeeper.ZooKeeperHiveLockManager.releaseLocks(ZooKeeperHiveLockManager.java:222) [hive-exec-2.1.1.jar:2.1.1]
            at org.apache.hadoop.hive.ql.lockmgr.DummyTxnManager.releaseLocks(DummyTxnManager.java:188) [hive-exec-2.1.1.jar:2.1.1]
            at org.apache.hadoop.hive.ql.Driver.releaseLocksAndCommitOrRollback(Driver.java:1136) [hive-exec-2.1.1.jar:2.1.1]
            at org.apache.hadoop.hive.ql.Driver.rollback(Driver.java:1516) [hive-exec-2.1.1.jar:2.1.1]
            at org.apache.hadoop.hive.ql.Driver.runInternal(Driver.java:1456) [hive-exec-2.1.1.jar:2.1.1]
            at org.apache.hadoop.hive.ql.Driver.run(Driver.java:1171) [hive-exec-2.1.1.jar:2.1.1]
            at org.apache.hadoop.hive.ql.Driver.run(Driver.java:1166) [hive-exec-2.1.1.jar:2.1.1]
            at org.apache.hive.service.cli.operation.SQLOperation.runQuery(SQLOperation.java:242) [hive-service-2.1.1.jar:2.1.1]
            at org.apache.hive.service.cli.operation.SQLOperation.access$800(SQLOperation.java:91) [hive-service-2.1.1.jar:2.1.1]
            at org.apache.hive.service.cli.operation.SQLOperation$BackgroundWork$1.run(SQLOperation.java:334) [hive-service-2.1.1.jar:2.1.1]
            at java.security.AccessController.doPrivileged(Native Method) ~[?:1.8.0_45]
            at javax.security.auth.Subject.doAs(Subject.java:422) [?:1.8.0_45]
            at org.apache.hadoop.security.UserGroupInformation.doAs(UserGroupInformation.java:1671) [hadoop-common-2.6.0-cdh5.5.0.jar:?]
            at org.apache.hive.service.cli.operation.SQLOperation$BackgroundWork.run(SQLOperation.java:347) [hive-service-2.1.1.jar:2.1.1]
            at java.util.concurrent.Executors$RunnableAdapter.call(Executors.java:511) [?:1.8.0_45]
            at java.util.concurrent.FutureTask.run(FutureTask.java:266) [?:1.8.0_45]
            at java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1142) [?:1.8.0_45]
            at java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:617) [?:1.8.0_45]
            at java.lang.Thread.run(Thread.java:745) [?:1.8.0_45]

锁泄露除了修复这个 ISSUE 以外比较难处理。在公司中，如果有成熟的调度器协调任务的依赖关系，那么非常建议禁用掉 Hive 的锁机制。在表数量众多，分区众多的场景下，使用 Zookeeper 的代价也是非常高的。

## 参考资料

- [https://cwiki.apache.org/confluence/display/Hive/Locking](https://cwiki.apache.org/confluence/display/Hive/Locking)
- [https://issues.apache.org/jira/browse/HIVE-1293](https://issues.apache.org/jira/browse/HIVE-1293)
- [https://issues.apache.org/jira/browse/HIVE-15997](https://issues.apache.org/jira/browse/HIVE-15997)

