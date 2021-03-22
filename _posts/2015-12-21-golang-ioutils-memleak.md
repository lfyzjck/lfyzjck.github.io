---
title: ioutil.ReadAll 引发的内存泄露
---

ioutil.ReadAll 引发的内存泄露
===


最近线上的一个计数服务突然出现内存不足的情况，服务器 4G 的内存会在几分钟内被耗尽。计数服务是兼容 [Redis Protocol][redis-protocol] 的，多方查找，最终确定问题出在 [Redis Protocol][redis-protocol] 的解析上面。协议解析的实现部分借鉴了 [docker/go-redis-server] [go-redis-server] 。

简化的代码如下：

```Golang
// parse redis protocol from bufio.Reader
func parse(r *bufio.Reader) ([][]byte, error) {
	line, err := r.ReadString('\n')
	var argsCount int
	if line[0] == '*' {
		fmt.Sscanf(line, "*%d\r", &argsCount)
	}
	args := make([][]byte, argsCount, argsCount)
	for i := 0; i < argsCount; i++ {
		if args[i], err = readArgument(r); err != nil {
			return nil, err
		}
	}
	return args, nil
}

func readArgument(r *bufio.Reader) ([]byte, error) {
	line, err := r.ReadString('\n')
	var argSize int
	_, err = fmt.Sscanf(line, "$%d\r", &argSize)
	if err != nil {
		return nil, err
	}
	data, err := ioutil.ReadAll(io.LimitReader(r, int64(argSize)))
	if err != nil {
		return nil, err
	}
	// check data size
	if len(data) != argSize {
		return nil, fmt.Errorf("error length of data.")
	}
	// check \r
	if b, err := r.ReadByte(); err != nil || b != '\r' {
		fmt.Printf("%s\n", string(b))
		return nil, fmt.Errorf("line should end with \\r\\n")
	}
	// check \n
	if b, err := r.ReadByte(); err != nil || b != '\n' {
		return nil, fmt.Errorf("line should end with \\r\\n")
	}
	return data, nil

}
```

然后调用 1w 次，看看系统总共分配的内存，这里我们会用到 Golang 的 [pprof][pprof] 工具，详细的用法可以参考这里 [profiling-go-programs][pprof-usage] 。

```go
// write heap profile to a tmp file.
func writeHeap(filename string) {
	f, err := os.Create(filename)

	if err != nil {
		log.Fatal(err)
	}
	pprof.WriteHeapProfile(f)

	defer f.Close()
}

func main() {
	s := []byte("*2\r\n$3\r\nGET\r\n$3\r\nKEY\r\n")
	for i := 0; i < 10000; i++ {
		buffer := bytes.NewReader(s)
		r := bufio.NewReaderSize(buffer, len(s))
		data, err := parse(r)
		if err != nil {
			panic(err)
		}
		fmt.Printf("%s\n", data)
	}
	writeHeap("bytes.mprof")
}
```

假设以上代码保存为 `readBytes.go`, 通过 `go build` 编译然后生成二进制文件（ pprof 需要），运行一下，我们会得到 `bytes.mprof` 文件。在 shell 里执行 pprof 命令：

```
$ go tool pprof --alloc_space readBytes bytes.mprof
Adjusting heap profiles for 1-in-524288 sampling rate
Welcome to pprof!  For help, type 'help'.
(pprof) top
Total: 49.5 MB
    31.5  63.6%  63.6%     31.5  63.6% bytes.makeSlice
    13.0  26.3%  89.9%     44.5  89.9% io/ioutil.readAll
     1.5   3.0%  92.9%      1.5   3.0% fmt.newScanState
     0.5   1.0%  93.9%      0.5   1.0% allocg
     0.5   1.0%  94.9%      0.5   1.0% fmt.(*ss).scanNumber
     0.5   1.0%  96.0%      2.5   5.1% fmt.Sscanf
     0.5   1.0%  97.0%     47.5  96.0% main.readArgument
     0.5   1.0%  98.0%      0.5   1.0% reflect.unsafe_New
     0.5   1.0%  99.0%      0.5   1.0% runtime.convT2E
     0.5   1.0% 100.0%      0.5   1.0% runtime.mallocinit
```
一个简单的程序怎么会消耗掉 49.5 MB 内存？我们要解析的源字符串很小，只有 22 Bytes 。处理 1w 次加成自身复制的开销，估算一下内存开销大概是:

> `22 Bytes * 10000 * 2 = 440000 Bytes = 400 KB`

那么这夸张的 49.5 MB从何而来？根据 pprof 的分析，大部分内存开销集中在 `bytes.makeSlice` 和 `io/ioutil.readAll` 上面，我们的程序也确实有调用 `ioutil.ReadAll()`

ioutil.ReadAll实现
------------------

```go
func readAll(r io.Reader, capacity int64) (b []byte, err error) {
	buf := bytes.NewBuffer(make([]byte, 0, capacity))
	defer func() {
		e := recover()
		if e == nil {
			return
		}
		if panicErr, ok := e.(error); ok && panicErr == bytes.ErrTooLarge {
			err = panicErr
		} else {
			panic(e)
		}
	}()
	_, err = buf.ReadFrom(r)
	return buf.Bytes(), err
}

// bytes.MinRead = 512
func ReadAll(r io.Reader) ([]byte, error) {
	return readAll(r, bytes.MinRead)
}
```

可以看到，`ioutil.ReadAll` 每次都会分配初始化一个大小为 `bytes.MinRead` 的 buffer ，`bytes.MinRead` 在 Golang 里是一个常量，值为 `512` 。就是说每次调用 `ioutil.ReadAll` 都会分配一块大小为 512 字节的内存，由于我们要解析的 Redis Protocol 包含 2 个参数，所以每次解析会掉用 2 次 `ioutil.ReadAll()`。总共分配的内存大小为：

> `512 Bytes * 2 * 10000 = 10240000 Bytes = 10.24 MB`

这个数字很接近 pprof 上给的 13 MB 了，那么剩下的就是 `bytes.makeSlice` 的内存开销了。搜索了一下，发现 `ioutil.ReadAll()` 里会调用 `bytes.Buffer.ReadFrom`, 而 `bytes.Buffer.ReadFrom` 会进行 `makeSlice` :

```
// ReadFrom reads data from r until EOF and appends it to the buffer, growing
// the buffer as needed. The return value n is the number of bytes read. Any
// error except io.EOF encountered during the read is also returned. If the
// buffer becomes too large, ReadFrom will panic with ErrTooLarge.
func (b *Buffer) ReadFrom(r io.Reader) (n int64, err error) {
	b.lastRead = opInvalid
	// If buffer is empty, reset to recover space.
	if b.off >= len(b.buf) {
		b.Truncate(0)
	}
	for {
		if free := cap(b.buf) - len(b.buf); free < MinRead {
			// not enough space at end
			newBuf := b.buf
			if b.off+free < MinRead {
				// not enough space using beginning of buffer;
				// double buffer capacity
				newBuf = makeSlice(2*cap(b.buf) + MinRead)
			}
			copy(newBuf, b.buf[b.off:])
			b.buf = newBuf[:len(b.buf)-b.off]
			b.off = 0
		}
		m, e := r.Read(b.buf[len(b.buf):cap(b.buf)])
		b.buf = b.buf[0 : len(b.buf)+m]
		n += int64(m)
		if e == io.EOF {
			break
		}
		if e != nil {
			return n, e
		}
	}
	return n, nil // err is EOF, so return nil explicitly
}
```

这个函数主要作用就是从 `io.Reader` 里读取的数据放入 buffer 中，如果 buffer 空间不够，就按照每次 `2x + MinRead` 的算法递增，这里 `MinRead` 的大小也是 512 Bytes ，由于我们每次调用 `ioutil.ReadAll` 读取的数据远小于 512 Bytes ，照理说不会触发 `buffer grow` 的算法，但是仔细看下实现发现不是这么回事，`buffer grow` 的算法大概是是这样子的：

1. 计算 buffer 剩余大小 free;
2. 如果 free < MinRead, 分配一个大小为 `2 * cap + MinRead` 的 newBuf, 把老
buffer 的数据拷贝到 newBuf;
3. 如果 free >= MinRead, 读取数据到 buffer, 遇到错误就返回，否则跳转到第 1 步.

因为我们用了 `io.LimitReader` , 第一趟循环只会读取固定字节的数据，不会触发任何错误。但是第二次循环的时候，由于 buffer 的剩余空间不足，就会触发一次 `buffer grow` 的算法，再分配一个大小为 1536 Bytes 的 Buffer , 然后再次 Read() 的时候会返回 `io.EOF` 的错误。这就是为什么会有那么多次 `makeSlice` 调用的原因，继续估算一下 `makeSlice` 的消耗：

> `1536 Bytes * 2 * 10000 = 30.72 MB`

把 2 次消耗的内存加起来, 2w 次 `ioutil.ReadAll()` 的时间内存消耗为 `10.24 MB +
30.72 MB = 40.96 MB`。( 倒吸一口凉气

实际线上发生的情况，并没有这么多的请求，但是每次请求却比较大。就是说每个请求会包含上万个参数，等价的调用了上万次的 `ioutil.ReadAll` , 消耗了大量的内存。但是仅仅这样，只是程序执行时消耗了比较多的内存，并未有内存泄露的情况，那服务器又是如何内存不足的呢？这就不得不扯到 Golang 的 GC 机制。

Golang 的 GC
------------

Golang 的 GC 采用经典的 [Mark-and-Sweep][mark-and-sweep], [Mark-and-Sweep][mark-and-sweep] 分为 2 个阶段：

* 第一阶段：从几个跟变量开始，扫描所有的 objects , 然后标记 `isMarked = true`
* 第二阶段：扫描 heap ，对所有为标记的变量进行回收

这个 GC 的过程会终止程序的运行直到回收完毕，不过从 Golang 1.3 开始，在第一阶段结束后，程序就会恢复运行，然后单独起一个 goroutine 来进行 Sweep 的操作。忽略一些细节，Golang 的 GC 大致遵循以下几个原则：

* 已分配的 Heap 到达某个阈值，会触发 GC, 该阈值由上一次 GC 时的 HeapAlloc 和 GCPercent 共同决定
* 每 2 分钟会触发一次强制的 GC，将未 mark 的对象释放，但并不还给 OS
* 每 5 分钟会扫描一个 Heap, 对于一直没有被访问的 Heap，归还给 OS

然后回头看下上面的场景，一个大请求会多次调用 `ioutil.ReadAll` 分配很多内存空间，并发的时候，会在很短时间内占用大量的系统内存，然后将 GC 阈值增加到一个很高的值，这个时候要 GC 就只有等 2 分钟一次的强制 GC。2 分钟内，无法阻止内存继续上涨，Golang 的 Heap 会吃光 OS 的内存，并且一直霸占着不归还给 OS， 造成 OS 整体性能下滑，程序的正常运行会变得很慢（包括负责 GC 的 goroutine），于是整台服务器就像多米诺骨牌一样倒下了。

怎么解决？
---------

问题的根本原因还是，系统在合理的负载内，浪费了大量的内存空间，加上 GC 的延时，最终导致系统的崩溃。所以还是要解决内存浪费的问题，最终还是要避免不正确的使用 `ioutil.ReadAll`，稍微修改下上面的代码，我们用比较底层的 `bytes.Buffer.Read` 来读取固定的字节：

```go
func readArgument(r *bufio.Reader) ([]byte, error) {
	line, err := r.ReadString('\n')
	var argSize int
	_, err = fmt.Sscanf(line, "$%d\r", &argSize)
	if err != nil {
		return nil, err
	}
    // look at here !!!!!!!!!!
	data := make([]byte, argSize)
	_, err = r.Read(data)
	if err != nil {
		return nil, err
	}
	// check data size
	if len(data) != argSize {
		return nil, fmt.Errorf("error length of data.")
	}
	// check \r
	if b, err := r.ReadByte(); err != nil || b != '\r' {
		fmt.Printf("%s\n", string(b))
		return nil, fmt.Errorf("line should end with \\r\\n")
	}
	// check \n
	if b, err := r.ReadByte(); err != nil || b != '\n' {
		return nil, fmt.Errorf("line should end with \\r\\n")
	}
	return data, nil

}
```

编译后再来看看 Heap 的分配情况，仍然使用 pporf 工具:

```
$ go tool pprof --alloc_space readBytes bytes.mprof
Adjusting heap profiles for 1-in-524288 sampling rate
Welcome to pprof!  For help, type 'help'.
(pprof) top
Total: 6.5 MB
     1.5  23.1%  23.1%      1.5  23.1% fmt.newScanState
     1.0  15.4%  38.5%      1.0  15.4% reflect.unsafe_New
     0.5   7.7%  46.2%      0.5   7.7% allocg
     0.5   7.7%  53.8%      0.5   7.7% bufio.(*Reader).ReadString
     0.5   7.7%  61.5%      0.5   7.7% bufio.NewReaderSize
     0.5   7.7%  69.2%      5.5  84.6% main.main
     0.5   7.7%  76.9%      3.0  46.2% main.parse
     0.5   7.7%  84.6%      1.5  23.1% main.readArgument
     0.5   7.7%  92.3%      0.5   7.7% runtime.convT2E
     0.5   7.7% 100.0%      0.5   7.7% runtime.mallocinit
```

如何？Golang 分配的内存显著减少了，问题至此就解决了，但是我还是想吐槽这种神坑.....

给 [docker/go-redis-server][go-redis-server] 提了 Issue，至今没人回复, 呵呵，该睡觉了。


[go-redis-server]: https://github.com/docker/go-redis-server
[redis-protocol]: http://redis.io/topics/protocol
[pprof-usage]: http://blog.golang.org/profiling-go-programs
[pprof]: http://golang.org/pkg/runtime/pprof/
[mark-and-sweep]: http://www.brpreiss.com/books/opus5/html/page424.html


