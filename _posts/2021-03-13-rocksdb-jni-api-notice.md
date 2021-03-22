---
author: lfyzjck
title: RocksDB Java API Notice
---

# RocksDB Java API Notice

最近实现的一个日志收集的服务使用了 RocksDB，项目由 Java 实现所以使用了 [rocksdbjni](https://mvnrepository.com/artifact/org.rocksdb/rocksdbjni)。网上关于 RocksDB Java 客户端的资料，除了官网 Wiki 以外意外的非常少。在这个过程中踩了非常多的坑，总结一下，希望能帮到一样在 RocksDB Java 客户端挣扎的人。

### JNI 简介

JNI 是 JVM 调用原生（Native）C/C++ 的规范。在遇到 Java 无法解决的某些场景时会非常有用：比如某些平台相关的库或者接口。JNI 允许在 Native 方法创建或者使用 Java 的对象提供的方法。

### Try-with-resource

由于 JNI 产生的对象本质上的 Native 对象，JVM 自己并不知道 C/C++ 的堆，这些 Native 对象都是堆 GC 不可见的，也无法被 GC 回收。在 RocksJava 中，所有的 Object 都继承自 `AbstractNativeReference` 

```java
public abstract class AbstractNativeReference implements AutoCloseable {

  protected abstract boolean isOwningHandle();

  /**
   * Frees the underlying C++ object
   * <p>
   * It is strong recommended that the developer calls this after they
   * have finished using the object.</p>
   * <p>
   * Note, that once an instance of {@link AbstractNativeReference} has been
   * disposed, calling any of its functions will lead to undefined
   * behavior.</p>
   */
  @Override
  public abstract void close();

  /**
   * @deprecated Instead use {@link AbstractNativeReference#close()}
   */
  @Deprecated
  public final void dispose() {
    close();
  }

  /**
   * Simply calls {@link AbstractNativeReference#dispose()} to free
   * any underlying C++ object reference which has not yet been manually
   * released.
   *
   * @deprecated You should not rely on GC of Rocks objects, and instead should
   * either call {@link AbstractNativeReference#close()} manually or make
   * use of some sort of ARM (Automatic Resource Management) such as
   * Java 7's <a href="https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html">try-with-resources</a>
   * statement
   */
  @Override
  @Deprecated
  protected void finalize() throws Throwable {
    if(isOwningHandle()) {
      //TODO(AR) log a warning message... developer should have called close()
    }
    dispose();
    super.finalize();
  }
}
```

`AbstractNativeReference` 维护了到 Native 对象的指针，其中 `finalize` 方法代理的 `close` 方法用于回收 native 对象的内存。虽然这样可以保证在 `AbstractNativeReference` 被 GC 时也能回收掉 Native 内存，但是由于 JVM 感知不到 C/C++ 的堆使用，这样做显然不利于内存管理。更好的方式时每次使用 `AbstractNativeReference` 时都显式的调用 `close` 方法释放 native 内存。

JDK 7 中引入的新语法 [try-with-resource](https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html) 允许所有实现了 `java.lang.AutoCloseable` 的对象被看作资源（resource），在 `finally` 块执行的时候隐式调用 `close()` 来关闭资源。

```java
static String readFirstLineFromFile(String path) throws IOException {
    try (BufferedReader br =
                   new BufferedReader(new FileReader(path))) {
        return br.readLine();
    }
}
```

try-with-resource 语法很好的解决了我们需要及时释放 native 内存的需求，于是操作 RocksJava 的代码变成了:

```java
import org.rocksdb.RocksDB;
import org.rocksdb.RocksDBException;
import org.rocksdb.Options;
...
  // a static method that loads the RocksDB C++ library.
  RocksDB.loadLibrary();

  // the Options class contains a set of configurable DB options
  // that determines the behaviour of the database.
  try (final Options options = new Options().setCreateIfMissing(true)) {
    
    // a factory method that returns a RocksDB instance
    try (final RocksDB db = RocksDB.open(options, "path/to/db")) {
    
        // do something
    }
  } catch (RocksDBException e) {
    // do some error handling
    ...
  }
...
```

其中 `options` 和 `db` 对象都是 `AbstractNativeReference` ，通过 try-with-resource 的语法可以很好的避免忘记调用 close 的情况出现。

### Check status() after every operation When using iterator

在使用 Iterator 时，有些 RocksDB 内部的错误不会随着调用立即抛出。所以光检查 `iterator→isValid()` 还不够。比较好的做法是封装一个 IteratorWrapper，在每次操作后做一次检查，可以避免很多潜在的问题。

```java
public class RocksIteratorWrapper implements RocksIteratorInterface, Closeable
{

    private RocksIterator iterator;

    public RocksIteratorWrapper(@Nonnull RocksIterator iterator) {
        this.iterator = iterator;
    }

    @Override
    public boolean isValid() {
        return this.iterator.isValid();
    }

    @Override
    public void seekToFirst() {
        iterator.seekToFirst();
        status();
    }

    @Override
    public void seekToLast() {
        iterator.seekToFirst();
        status();
    }

    @Override
    public void seek(byte[] target) {
        iterator.seek(target);
        status();
    }

    @Override
    public void seek(ByteBuffer target)
    {
        iterator.seek(target);
        status();
    }

    @Override
    public void seekForPrev(ByteBuffer target)
    {
        iterator.seekForPrev(target);
        status();
    }

    @Override
    public void refresh()
            throws RocksDBException
    {
        iterator.refresh();
        status();
    }

    @Override
    public void seekForPrev(byte[] target) {
        iterator.seekForPrev(target);
        status();
    }

    @Override
    public void next() {
        iterator.next();
        status();
    }

    @Override
    public void prev() {
        iterator.prev();
        status();
    }

    @Override
    public void status(){
        try {
            iterator.status();
        } catch (RocksDBException ex) {
            throw new LoghubRuntimeException("Internal exception found in RocksDB", ex);
        }
    }

    public byte[] key() {
        return iterator.key();
    }

    public byte[] value() {
        return iterator.value();
    }

    @Override
    public void close() {
        iterator.close();
    }
}
```

### Reuse JNI Object

虽然 try-with-resource 的语法能保证 JVM 及时释放 native 内存，但是创建 Native 对象仍然有不少额外开销，尤其是会随着用户请求放大的操作。

```java
class RocksDBWrapper {
  public void put(byte[] key, byte[] value) {
		try (final WriteOptions options = new WriteOptions()){  
		    db.put(options, key, value);
		} catch (RocksDBException e) {
		  // error handling
		}
  }
}

// reuse WriteOptions
class RocksDBWrapper {
  private final WriteOptions options = new WriteOptions();
  public void put(byte[] key, byte[] value) {
		try {  
		    db.put(options, key, value);
		} catch (RocksDBException e) {
		  // error handling
		}
  }
}
```

### Avoid Using Custom Java Comparator

Comparator 是 RocksDB 中一个比较重要的概念，它的实现决定了 key 的存储的顺序。默认的Comparator 是 ByteWiseComparator，对于 string 类型的 key 来说，ByteWiseComparator 就是字典序。

RocksJava API 中有一个抽象的 `AbstractComparator` 允许 Java 用户自定义 Comparator 的实现。比如我们可以为 Long 类型的 Key 实现一个自定义的 Comparator：

```java
public class LongValueComparator
        extends AbstractComparator
{

    public LongValueComparator()
    {
        super(new ComparatorOptions().setUseDirectBuffer(true));
    }

    @Override
    public String name()
    {
        return "LongValueComparator";
    }

    @Override
    public int compare(ByteBuffer a, ByteBuffer b)
    {
        Long keyA = Longs.fromByteArray(a.array());
        Long keyB = Longs.fromByteArray(b.array());
        return Long.compare(keyA, keyB);
    }
}
```

> RocksDB 在 6.8 版本出于性能原因[修改了 RocksJava 的 Comparator 接口](https://github.com/facebook/rocksdb/pull/6252)，参数类型从 Slice 改为 ByteBuffer

但是由于 Comparator 不论在写入还是读取，包括 MemTable flush 时都会频繁调用。JNI 调用的 Overhead 会被无限放大，导致 Java 实现的 Comparator 性能非常糟糕。官方 benchmark 的结果是性能差距在 5~6 倍之间。所以不论出于什么原因都不建议用 Java 实现自己的 Comparator，保持默认值，在 Serde 层做自己想做的事情。下图是通过 Java 实现 Comparator 后，FlushMemTable 的火焰图：

![https://s3-us-west-2.amazonaws.com/secure.notion-static.com/4f42422e-4f35-4792-ae10-308d078f0051/Untitled.png](https://s3-us-west-2.amazonaws.com/secure.notion-static.com/4f42422e-4f35-4792-ae10-308d078f0051/Untitled.png)

### Monitor RocksDB

由于 JNI 的存在，Native 内存的使用不会出现你的 JVM 监控中，既不是 Heap 也不是 Non-Heap，所以针对使用了 RocksDB 的 Java 应用，必须将进程的 Memory 监控起来。简单说来就是：

Native Memory = Process Memory - ( JVM Heap + JVM Non-Heap + DirectBuffer)

上面公式不准确，这部分内存还包括线程的栈空间以及 Metaspace 等区域的内存，不过用作估算足够用了。

另外 RocksDB 提供了 Statistics 类来存储一些统计信息，我们可以将这些信息导出到应用的 Metrics 中。

![https://s3-us-west-2.amazonaws.com/secure.notion-static.com/5e741471-da11-4895-bf76-3bf7cf161b78/Untitled.png](https://s3-us-west-2.amazonaws.com/secure.notion-static.com/5e741471-da11-4895-bf76-3bf7cf161b78/Untitled.png)

### 总结

网上关于 RocksJava 的讨论不多，希望这个总结对你有帮助。如果有什么遗漏的，欢迎评论。

### Reference

- RocksJava Basics [https://github.com/facebook/rocksdb/wiki/RocksJava-Basics](https://github.com/facebook/rocksdb/wiki/RocksJava-Basics)
- The try-with-resources Statement [https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html](https://docs.oracle.com/javase/tutorial/essential/exceptions/tryResourceClose.html)
- JNI wikipedia: [https://zh.wikipedia.org/wiki/Java本地接口](https://zh.wikipedia.org/wiki/Java%E6%9C%AC%E5%9C%B0%E6%8E%A5%E5%8F%A3)

