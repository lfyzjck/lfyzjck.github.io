---
title: Golang依赖管理实践
---

Golang依赖管理实践
===


引子
-------

这篇文章似乎拖得有点久了，好在现在在写了。Golang 的风潮尚未过去，大红大紫的 Docker 进一步提高了人们对这门语言的期待，但是当你把 Golang 用在线上生产环境的时候，就会面临一个比较严重问题：依赖管理。

对于依赖管理，Java 有 `Maven`，Python 有 `pip`，Nodejs 也有 `npm`，Golang 自己本身作为一种编译型的语言，依赖管理只能靠官方提供的 `go-get` 工具，大部分情况下，这个工具对我们在开发时还是相当友好的。

go get 简介
----------

`go-get`是 Golang 自带的一个依赖管理工具，他可以从远程下载你需要的包，但是注意Golang并没有统一的仓库，所以你传给 `go get` 的参数其实是一个URL。对于 Github, Google Code, Bitbucket 这样的网站，`go get` 可以自动解析到 repo 地址，典型的 `go get` 大概会包含下面几个步骤：

* fetch repo 到本地的 `$GOPATH/src` 下, 此过程会依赖 repo 对应版本管理软件，比如你要安装一个 Github 上的包，那么你本地必须安装了 git
* 执行`go install`命令，对源码进行编译并把编译好的二进制文件拷贝到`$GOPATH/pkg`下面
* 如果不是 Github 这样第三方托管网站，比如公司内的 Gitlab 系统，`go get`会解析 html 返回中名为`go-import`的`meta`标签，找到 repo 的类型和地址，然后重复上面的事情

不过这样的实现会有一点问题，假如我们用了类似Gitlab的系统，在公司内部的很多 repo 都是 Internal 的，`go get`无法直接访问到 repo 页面，自然谈不上解析 `go-import` ，`go get` 还没只能到可以自动登录，所以一定是失败的，我们依赖的 Package 还是无法自动安装......

生产环境的挑战和 Godep 工具
--------------------------

不同于本地开发可以想到什么依赖就安装一下，少了东西可以再补，生产环境通常需要一套可靠的自动化流程来完成软件极其依赖的构建，比如像 `Maven` 和 `buildout` 这样的工具，既可以做到自动构建，又可以做到环境隔离。

`go get` 工具能用但是我们经常会忘记在 go get install 列表里写上我们的依赖，上线的时候才发现："啊，我这个包手贱忘记写进去了，怎么办！"

程序员的这种需求不可能不被照顾到，所以就有了 [Godep](title "Godep") 这个工具，[Godep] 使用还是很简单的，常用的命令就2个：

* `godep save`, 扫描你的代码中的`import`，把所有依赖的包都写入一个 json 文件
* `godep restore`, 读取上一步生成的 json 文件，调用 `go get` 安装每个依赖

所以很多行的`go get`命令变成了一行命令，妈妈再也不用担心我上学出门忘记背书包了。

但是文章写到这里，似乎还有几个问题没解决:

* 三方库可以从 Github 或者 Bitbucket 这样的网站获取，公司内部的二方库该如何解决呢？我们的 Gitlab 仓库就是私有的怎么办？
* Google Code 分明在天朝无法通过正常途径访问，Github 也经常抽风，你这工具是要闹咋样

对，线上的服务器无法和我们自己开发时的网络环境等同，所以不论是 Golang 自带 `go get` 还是 [Godep] 都有不完美的地方，所以还是本地大法好。

Vendor方式管理的依赖
-------------------

这种方式就是来解决前面说的 2 个问题的，基本思路就是在项目中新建一个名为 `vendor` 的目录，把依赖放在该目录下，实践中我们一般会采用 `git submodule` 来做这件事情：

```bash
cd YOUR_PROJECT
mkdir vendor
git submodule add git://repo.git vendor/
```

然后在项目发布构建时：

```bash
cd YOUR_PROJECT
git submodule update --init
```

好处是不需要把依赖包的代码直接放入项目源代码中，并且可以实现自动化的构建。坏处也是有的，你必须修改代码中 `import` 的地址。

实践中，一般推荐 [Godep] 和 `vendor` 结合的方式来管理项目中的依赖。

结论
----

上面已经写过了。

参考
----

1. http://golang.org/doc/code.html#remote
2. http://peter.bourgon.org/go-in-production/


[Godep]: https://github.com/tools/godep


