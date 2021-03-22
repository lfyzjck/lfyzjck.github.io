---
title: Ansible 快速入门
---

# {{ page.title }}

{% raw %}
Ansible 是一个 IT 自动化软件，类似于 Puppet 和 Chef，是实现 Infra-as-a-code 的一种工具。

## QuickStart

### 理解 Ansible 如何控制远程服务器

Ansible 的所有操作是基于 ssh 协议的，我们可以通过 ssh 命令在远程服务器上执行命令：

```bash
$ ssh root@ip 'ping baidu.com'
PING baidu.com (39.156.69.79) 56(84) bytes of data.
64 bytes from 39.156.69.79 (39.156.69.79): icmp_seq=1 ttl=48 time=7.83 ms
64 bytes from 39.156.69.79 (39.156.69.79): icmp_seq=2 ttl=48 time=3.43 ms
64 bytes from 39.156.69.79 (39.156.69.79): icmp_seq=3 ttl=48 time=3.45 ms
64 bytes from 39.156.69.79 (39.156.69.79): icmp_seq=4 ttl=48 time=3.46 ms
```

在 Ansible 中编写的脚本最终也会被翻译成类似上面命令的方式被执行。

在 Ansible 执行的过程中，需要两种角色的节点，分别对应 ssh 的 client 和 server：

- 管理节点（执行 ansible 命令的机器）
- 托管节点（被 ansible 的管理的机器）

Ansible 的管理节点目前支持类 unix 系统，也就是 linux 和 macos。暂时不支持 windows 作为管理节点。管理节点可以是自己本地的电脑，但是由于私有化部署时我们面对的通常都是客户的内网环境，一般都无法在自己的开发机直接访问。为了简化使用方式，我们选择客户的一台服务器及作为管理节点也同时作为托管节点，所有 ansible 的操作总是从管理节点发起。

既然 Ansible 是基于 ssh 协议实现的，我们必须决定以哪个**用户**的身份登陆，以何种方式进行 **ssh 认证**，以及确保登陆用户有 **sudo** 的权限。ssh 常用的认证方式支持密码和证书两种，由于我们希望自动化部署，不想在部署过程中频繁的输入密码，因此配置证书认证是比较好的选择。另外很多客户环境下 sudo 也需要额外的密码，因此需要在初始化环境时配置 ssh 的登陆用户可以免密的进行 sudo 操作。

总结一下，我们需要：

- 选择一台客户内网的服务器作为管理节点，该节点通常也是我们的托管节点
- 对托管节点配置基于证书的 ssh 免密登陆
- 确保 ssh 登陆用户可以免密进行 sudo 操作

### Inventory File

Ansible 可同时操作属于一个组的多台主机,组和主机之间的关系通过 inventory 文件配置。默认的文件路径为 `/etc/ansible/hosts` 。不过我们通常不把  inventory file 放在系统目录下，而是放在单独的配置目录。

我们试着写一个 inventory file :

```yaml
[webserver]
host1
host2
```

保存为 `hosts` ，然后通过 ansible 的命令行执行 adhoc 命令

```yaml
$ ansible all -i hosts -m ping
host1 | UNREACHABLE! => {
    "changed": false,
    "msg": "Failed to connect to the host via ssh: ssh: Could not resolve hostname host1: nodename nor servname provided, or not known",
    "unreachable": true
}
host2 | UNREACHABLE! => {
    "changed": false,
    "msg": "Failed to connect to the host via ssh: ssh: Could not resolve hostname host2: nodename nor servname provided, or not known",
    "unreachable": true
}
```

其中 `all` 是 `<host-pattern>` ,  `all` 是一个特殊的 pattern，匹配所有 hosts。提示报错是预期的结果，因为 host1, host2 并不存在。

### Playbook，Role，Task

上一节展示了如何通过 ansible 执行 adhoc 命令，但是大部分时候我们用的更多的是 `ansible-playbook` 命令。Playbook 是 ansible 的任务编排语言，通过 YAML 来描述。关于 Playbook 和 role， task 的关系，一句话就可以说清楚：剧本 (playbook) 开始，角色们（role) 依次登上舞台，完成自己的任务 (task)。

playbook 一般是 ansible 执行的入口；role 更像是模块，是我们复用代码的基本单位；task 是一个个具体的实现。

先从一个不考虑复用的 playbook 开始：

```yaml
- hosts: all
  tasks:
    - name: install vim
      yum:
        name: vim
        state: present

    - name: install jdk
      yum:
        name: openjdk
        state: present
```

这个 playbook 会在所有机器上安装 vim 和 openjdk。yum 是 ansible 提供的一个模块，ansible 拥有非常强大的生态，我们需要几乎所有操作都被 ansible 很好的封装了。所有模块的文档可以参考：[https://docs.ansible.com/ansible/latest/modules/modules_by_category.html](https://docs.ansible.com/ansible/latest/modules/modules_by_category.html)

随着 task 越来越多，playbook 会变得非常长而且不容易维护，中间如果有重复部分也难以实现代码复用。这个时候就轮到角色（role） 登场了。

### 编写可复用的脚本

role 从代码上看就是一个特定结构的目录，典型的 role 目录结构如下：

```yaml
site.yml
webservers.yml
fooservers.yml
roles/
   common/
     files/
     templates/
     tasks/
     handlers/
     vars/
     defaults/
     meta/
   webservers/
     files/
     templates/
     tasks/
     handlers/
     vars/
     defaults/
     meta/
```

每个目录下默认的入口都是 `main.yml` 这个文件。然后我们可以在 playbook 中引入这个 role：

```yaml
---
- hosts: webservers
  roles:
     - common
     - webservers
```

role 和 role 之间可以设置依赖关系，通过依赖我们可以隐式的执行某些 role。角色依赖需要定义在 `meta/main.yml` 文件中：

```yaml
---
dependencies:
  - { role: common, some_parameter: 3 }
  - { role: apache, port: 80 }
  - { role: postgres, dbname: blarg, other_parameter: 12 }
```

> 当一个 playbook 包含多个 role，并且 role 依赖了共同的 role 时，可能会有重复执行的情况。ansible 有一些机制避免重复无意义的执行，但是该规则不是很容易直观理解。

## 变量

### **变量的定义**

**Inventory File**

```
[all:vars]
foo1=bar
foo2=bar2

[group1]
host1
host2

[group1:vars]
foo3=bar3
```

**PlayBook**

```yaml
---
- hosts: all
  vars:
    http_port: 80
  vars_prompt:
    - name: service_name
      prompt: "Which service do you want to remove?"
      private: no
  vars_files:
    - /vars/external_vars.yml
```

**Role**

有些变量只用于当前 role，可能会定义在 role 当中。一般位于 `defaults/mian.yml` 或者 `vars/` 目录下。

具体的使用参见：[https://docs.ansible.com/ansible/latest/user_guide/playbooks_reuse_roles.html](https://docs.ansible.com/ansible/latest/user_guide/playbooks_reuse_roles.html)

**Ansible 预定义**

部分变量是 Ansible 自己定义的变量，比如我们要获取机器的 hostname：

```bash
{{ ansible_facts['nodename'] }}
```

这部分预定义变量非常多，可以通过下面命令查看：

```bash
$ ansible hostname -m setup
{
    "ansible_all_ipv4_addresses": [
        "REDACTED IP ADDRESS"
    ],
    "ansible_all_ipv6_addresses": [
        "REDACTED IPV6 ADDRESS"
    ],
    "ansible_apparmor": {
        "status": "disabled"
    },
    "ansible_architecture": "x86_64",
    "ansible_bios_date": "11/28/2013"
		......
}
```

**Command Line**

```bash
ansible-playbook site.yml --extra-vars='{"foo": "bar"}'
```

[https://docs.ansible.com/ansible/latest/user_guide/playbooks_variables.html](https://docs.ansible.com/ansible/latest/user_guide/playbooks_variables.html)

### 变量的作用域

ansible 的变量作用域主要有 3 种：

- Global：ansible 配置文件，环境变量，命令行
- Play：playbook vars, vars_prompt, vars_files; role defaults, vars
- Host: Inventory 中定义的的 host vars; facts

### 变量使用

ansible 允许你在各处通过 jinja2 的语法使用变量。jinja2 是一个用 Python 开发的模版引擎，本身并不复杂，核心东西就 3 个：变量的输出，控制流，filter

两个大括号包起来表示输出变量：

```
I'm {{ name }}
```

变量输出时可以用过 filter 控制格式，类似 bash 里的 pipeline。filter 本质上是一个 Python 的函数，有一个入参和一个返回结果：

```
I'm {{ name | trim | title }}
```

控制流需要区别于输出，用 `{% %}` 表示。比如一个 for 循环

```
{% for name in names %}
I'm {{ name | title }}
{% endfor %}
```

条件判断

```
{% for name in names %}
{% if ignore_case %}
I'm {{ name | lower }}
{% else %}
I'm {{ name }}
{% endif %}
{% endif %}
```

上面就是 jinja2 的介绍，更多细节需要去看文档。

需要注意的是，在 Ansible 中如果你要使用 jinja2 的语法去引用一个变量，必须用双引号内使用。

```yaml
- hosts: all
  vars:
    deploy_path: "{{ home_dir }}/apps"
```

比如我们想根据各种上下文生成 nginx 的配置文件，可以通过 template 命令来渲染。首先定一个模版文件 `nginx.conf.j2`

```
server {
  server_name {{ server_name }};
  listen 80;
  
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

我们希望这个配置文件可以覆盖默认的 nginx 配置：

```yaml
- hosts: nginx
  vars:
    server_name: gio.com
    nginx_user: nginx
    nginx_group: "{{ nginx_user }}"
  tasks:
	- name: generate nginx config file
	  template:
	    src: nginx.conf.j2
	    dest: /etc/nginx/nginx.conf
	    owner: "{{ nginx_user }}"
	    group: "{{ nginx_group }}"
	  become: yes
```

## 最佳实践

### 保持操作的幂等

shell 脚本在执行时，很多命令的执行结果不是确定的。很多时候我们无法避免的需要反复重试某些脚本：

- 脚本自身有 bug，修完以后需要重试
- 机器状态不确定。比如脚本执行过程中机器重启了；免密 sudo 忘记配置结果执行到某个需要 sudo 的 task 时跪了。
- 命令本身执行结果就是不确定的，比如通过 systemd 启动一个进程，systemctl start 命令返回成功并不代表真的启动成功了。

ansible 的写法都是声明式而不是命令式。命令描述过程，声明式描述意图。明确的意图可以让 ansible 可以更好的帮你决定是否要重试某个任务，安全的隐藏细节。比如我们删除某个文件，命令式描述这样的：

```yaml
- name: delete file
  command: rm /tmp/xxx
```

但是当我们重复跑这个 task 时，已经被删除文件无法再次被删除，需要在每次删除前检查目标文件是否已经被删除。但是用声明式的写法就很容易实现：

```yaml
- name: delete file
  file:
    src: /tmp/xxx
    state: absent
```

编写 ansible 脚本时，要始终记得一件事：不要想着你要做什么操作，而是描述你期望某个对象的状态是怎么样的。

### 谨慎处理非 root 用户运行时的逻辑

ansible 的 task 有两个属性 `become` 和 `become_user` ，分别代表是否要使用 sudo 以及 sudo 的用户。比如创建一个目录并指定目录的 owner 和 group

```yaml
- name: create dir
  file:
    path: /etc/foo
    state: directory
    owner: foo
    group: foo
```

如果我们以 root 用户的身份执行 ansible 脚本，上面的脚本没有任何问题。但是如果是一个有 sudo 权限的普通用户，如果没有显式使用 sudo 的话，没有权限在 `/etc` 目录下创建任何东西。这是时候就需要使用 `become`

```yaml
- name: create dir
  file:
    path: /etc/foo
    state: directory
    owner: foo
    group: foo
  become: yes
```

### 测试脚本

检查语法：

```yaml
ansible-playbook --syntax-check <playbook>
```

Dry-run:

```yaml
ansible-playbook --check <playbook>
```

真实执行脚本：

由于测试可能需要反复执行，每次都申请服务器显然不现实，推荐本地用 VirtualBox + Vagrant 来进行测试。

首先定义 Vargrantfile，来创建 3 个虚拟机，hostname 是 hadoop[1-3]

```yaml
$ cat Vagrantfile                                                                                                                                                    
# -*- mode: ruby -*-
# vi: set ft=ruby :

# All Vagrant configuration is done below. The "2" in Vagrant.configure
# configures the configuration version (we support older styles for
# backwards compatibility). Please don't change it unless you know what
# you're doing.
Vagrant.configure("2") do |config|
  config.vm.define 'hadoop01' do |hadoop01|
    hadoop01.vm.box = 'centos/7'
    hadoop01.vm.hostname = 'hadoop01'
    hadoop01.vm.network "forwarded_port", guest: 80, host: 8000
    hadoop01.vm.network :private_network, :ip => '192.168.10.192'
    hadoop01.vm.provision :hosts, :sync_hosts => true
    hadoop01.vm.provision :hosts, :add_localhost_hostnames => false
    hadoop01.vm.provider :virtualbox do |v|
      v.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
      v.customize ["modifyvm", :id, "--memory", 2048]
      v.customize ["modifyvm", :id, "--name", "hadoop01"]
    end
  end

  config.vm.define 'hadoop02' do |hadoop02|
    hadoop02.vm.box = 'centos/7'
    hadoop02.vm.hostname = 'hadoop02'
    hadoop02.vm.network "forwarded_port", guest: 80, host: 8001
    hadoop02.vm.network :private_network, :ip => '192.168.10.193'
    hadoop02.vm.provision :hosts, :sync_hosts => true
    hadoop02.vm.provision :hosts, :add_localhost_hostnames => false
    hadoop02.vm.provider :virtualbox do |v|
      v.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
      v.customize ["modifyvm", :id, "--memory", 2048]
      v.customize ["modifyvm", :id, "--name", "hadoop02"]
    end
  end

  config.vm.define 'hadoop03' do |hadoop03|
    hadoop03.vm.box = 'centos/7'
    hadoop03.vm.hostname = 'hadoop03'
    hadoop03.vm.network "forwarded_port", guest: 80, host: 8002
    hadoop03.vm.network :private_network, :ip => '192.168.10.194'
    hadoop03.vm.provision :hosts, :sync_hosts => true
    hadoop03.vm.provision :hosts, :add_localhost_hostnames => false
    hadoop03.vm.provider :virtualbox do |v|
      v.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
      v.customize ["modifyvm", :id, "--memory", 2048]
      v.customize ["modifyvm", :id, "--name", "hadoop03"]
    end
  end
end
```

启动服务器并配置 ssh

```yaml
$ vagrant up

$ vagrat ssh-config
```

创建一个用于测试的 inventory file，然后执行 playbook：

```yaml
ansible-playbook <playbook> -i <inventory_file>
```

单元测试：

ansible 的单元测试比较接近集成测试。有第一个第三方的框架可以支持：

[https://molecule.readthedocs.io/en/latest/](https://molecule.readthedocs.io/en/latest/)

细节比较多这里不单独介绍，执行也需要依赖 docker 或者 vagrant

## Reference

- [https://en.wikipedia.org/wiki/Infrastructure_as_code](https://en.wikipedia.org/wiki/Infrastructure_as_code)
- [https://ansible-tran.readthedocs.io/en/latest/docs/intro.html](https://ansible-tran.readthedocs.io/en/latest/docs/intro.html)

{% endraw %}