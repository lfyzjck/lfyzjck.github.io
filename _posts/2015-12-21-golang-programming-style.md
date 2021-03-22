---
title: Golang编程风格不完全指南
---

{{ page.title }}
===

语言规范
--------

#### 简介

学习Go规范的最好办法就是看Go的源码，官方是这么说的

#### 格式化

格式这个东西，对大部分语言来说都挺重要的，不过Go有个很牛逼的工具叫`gofmt`，可以从`package`级别对代码的格式进行格式化，所以这种脏活就交给工具来做吧。

#### 注释

Go提供了C-style的/* */的块注释，和C++-style的// 行内注释

对于每个`package`，都应当提供响应的注释，如果这个`package`提供的功能很简单，那么用行内注释写一些简单的说明也是可以的。不必在块注释的每行前都加上`*`号，注释内的字体可能不是等宽字体，所以也不要依赖空格来对齐，`godoc`会帮你完成这些事情。

在一个`package`中，每个被`export`的方法，都应该包含注释.注释最好以方法名开头，然后用最简单的一句话概括这个函数的用途。

#### 命名

Go推荐采用类似Java的驼峰式的命名，而不是用下划线。
##### Package names

包名应该尽量简洁且容易记忆，处于习惯一般采用全部小写字母。每一个使用你提供的`Package`的用户，都需要提前`import`，所以你也不用特地的检测名字的冲突，万一不行还可以在本地使用别的名字代替。

##### Getter&Setter

`GetAttr`就命名成`Attr()`
`SetAttr`还是保持`SetAttr()`
然后注意首字母大写，确保这个函数是被`export`的

##### Interface

一般就是加个`er`的后缀，比如Reader, Writer, Notifer

#### 循环结构

Go的循环类似于C，稍有不同。Go统一了`for`和`while`，而且没有`do-while`

```
// Like a C for
for init; condition; post { }

// Like a C while
for condition { }

// Like a C for(;;)
for { }
```

如果要遍历的对象是`array`, `slice`, `string`, `map`或者从channel读取数据，可以使用`range`关键字。类似于Python的`for ... in ...`。在`range`循环里，可以单独访问key&value，或者一起访问。

```
// 只访问key
for key := range m {
    if key.expired() {
        delete(m, key)
    }
}
// 只访问value
sum := 0
for _, value := range array {
    sum += value
}
// 两个都要用
for key, value := range oldMap {
    newMap[key] = value
}
```


