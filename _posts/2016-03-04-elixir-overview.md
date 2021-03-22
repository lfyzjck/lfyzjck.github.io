elixir-overview
===

初窥 Elixir
===========

Elixir 是基于 Erlang VM 开发一个新语言，继承了 Erlang 的很多有点，在保持和 Erlang ByteCode 兼容的提前下提供了非常简洁易懂的语法。单从语法层面可能和 Ruby 比较像，不过仔细看还是和 Erlang 有很多一致的地方，如果你不习惯 Erlang 奇怪的语法(其实看过 Prolog 的语法以后就不觉得 Erlang 奇怪了)，但是又想享受 Erlang/OTP 带来的各种好处，Elixir 是不错的选择。

Elixir 可以调用 Erlang 的标准库，如果基本不用担心 第三方库不足的问题， Erlang 几十年的积累在这里放着呢，难怪 Joe Armstrong 大叔也对 Elixir 赞不绝口。

类型
-------

用 `iex` 来启动的 Elixir Shell，可以看到一个很像 Erlang Shell 的东西：

```
$ iex
Erlang/OTP 17 [erts-6.1] [source] [64-bit] [smp:4:4] [async-threads:10] [hipe] [kernel-poll:false] [dtrace]

Interactive Elixir (1.0.3) - press Ctrl+C to exit (type h() ENTER for help)
iex>
```

Elixir 支持 Erlang 大部分的类型，integer, float, atom, list, tuple, binary, keywords, map ...

```
iex> 1
1
iex> "foobar"
"foobar"
iex> 'foobar'
'foobar'
iex> :foo
:foo
iex> [1, 2, 3]
[1, 2, 3]
iex> {:foo, :bar}
{:foo, :bar}
iex> <<104, 101, 108, 108, 111, 0>>
<<104, 101, 108, 108, 111, 0>>
iex> [{:foo, 1}, {:bar, 2}]
[foo: 1, bar: 2]
iex> %{:ok => 1, :fail => 2}
%{fail: 2, ok: 1}
```

`"foobar"` 和 `'foobar'` 是不同的类型，前者是 string，后者是是一个 charlist

```
iex> is_binary "foobar"
true
iex> is_list 'foobar'
true
```

Elixir 引入了一个很像 Map 的类型叫 Keyword，但其实 Keyword  就是一个二元的 `tuple` 列表，不过要求 `tuple` 的第一个元素是 `atom`。Keyword 支持类似 Map 的访问方式

```
iex> keyword1 = [{:foo, 1}, {:bar, 2}]
[foo: 1, bar: 2]
iex> keyword1[:foo]
1
iex> keyword1[:bar]
2
```

Map 通过 `%{ key1 => value1, key2 => value2 ...}` 的语法来创建，访问 Map 中的值有 3 种方式：

```
iex> map = %{:a => 1, 2 => :b}
%{2 => :b, :a => 1}
iex> map[:a]
1
iex> map[2]
:b
```

不论 Map 还是 Keyword lists 都实现了 Dict 的访问协议，我们可以可以用 Dict 模块同时处理这 2 种数据结构。

```
iex> map
%{2 => :b, :a => 1}
iex> Dict.get(map, :a)
1
iex> Dict.put_new(map, :c, 3)
%{2 => :b, :a => 1, :c => 3}
```

模式匹配和递归
-----

Elixir 和 Erlang 一样，实现了模式匹配。模式匹配的强大不用多说，在解析数据的时候可以少写很多很多的 if...else... 

```
iex> {:ok, msg} = {:ok, "success"}
{:ok, "success"}
iex> %{:a => x} = %{:a => 1, :b => 2}
%{a: 1, b: 2}
iex> %{:a => x} = %{:b => 2}
** (MatchError) no match of right hand side value: %{b: 2}
```

Elixir 里的函数必须定义在 Module 里，让我们实现一个计算斐波那契数列的模块。

```
defmodule Math do
  @doc"""
  Calculate Fibonacci sequence value
  """
  def fab(1) do 1 end
  def fab(2) do 1 end
  def fab(n) do
    fab(n-1) + fab(n-2)
  end

  @doc """
  Calculates the sum of a number list
  """
  def sum(list) do sum(list, 0) end
  def sum([], sum) do sum end
  def sum([h|t], sum) do sum(t, sum + h) end
  
end
```

Enumerables & streams & Comprehensions
-----

`Enum` 和 `Stream` 最大的不同是 `Stream` 是惰性求值，类似 Python 里的 generator，只有需要计算的时候真正计算。

```
iex> Enum.map(1..10, fn x -> x * x end)
[1, 4, 9, 16, 25, 36, 49, 64, 81, 100]
iex> Enum.reduce(1..10, 0, &(&1+&2))
55
iex> 1..10 |> Enum.map(&(&1*&1)) |> Enum.reduce(&(&1+&2))
385
iex> 1..100 |> Stream.map(&(&1*&1)) |> Stream.filter(&(rem(&1, 2) != 0)) |> Enum.sum
166650
```

Elixir 也提供了列表推倒的机制，利用 for 的 filter 机制，还能方便实现一些功能。

```
iex> for n <- 1..4, do: n * n
[1, 4, 9, 16]
```

找到 n 以内满足 `a^2 + b^2 = c^2` 的 `{a, b, c}` 元组：

```
defmodule Triple do
  def pythagorean(n) when n > 0 do
    for a <- 1..n,
        b <- 1..n,
        c <- 1..n,
        a + b + c <= n,
        a*a + b*b == c*c,
        do: {a, b, c}
  end
end
```

异常处理
----

Elixir 提供了 3 种错误处理机制：

* Errors & Exceptions
* Throws
* Exits

```
iex> try do
...>   raise "oops"
...> rescue
...>   RuntimeError -> "Error!"
...> end
"Error!"

iex> spawn_link fn -> exit(1) end
#PID<0.56.0>
** (EXIT from #PID<0.56.0>) 1
```

调用 Erlang 代码
----

```
iex> angle_45_deg = :math.pi() * 45.0 / 180.0
iex> :math.sin(angle_45_deg)
0.7071067811865475
```

Process
----

Elixir 借助 ErlangVM 实现了 Actor 模型，进程和进程之间仅通过消息通信，每个 Actor 都有一个 Mailbox ，消息总是被拷贝到 MailBox 中然后等待进程处理。这里的 Process 和操作系统的 Process 不能等同，它比操作系统的 Process 要轻量很多，可能很轻松在单机上开启几十万的 Process。




