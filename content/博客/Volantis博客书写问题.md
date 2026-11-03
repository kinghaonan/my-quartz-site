---
title: Volantis博客书写问题
date: 2025-10-25
updated: 2025-10-25
description: 在Volantis主题上优雅地书写记录。
tags: [Volantis]
---

## 数学公式渲染引擎选择


### MathJax方案（兼容性优先）

适合需要完整LaTeX支持的场景，尤其推荐用于学术类内容。

### KaTeX方案（性能优先）

适合追求加载速度的场景，KaTeX渲染速度比MathJax快约60%，但对部分复杂公式支持有限。

## Volantis 主题内置前端渲染方案

Volantis 6 中在 front-matter 中配置页面插件[...](https://volantis.js.org/v6/page-settings/?keyword=math) 即可。

```yaml front-matter
---
plugins:
  - mathjax
  - katex
---
```

例如：

```yaml example.md:
---
title: 渲染公式（MathJax）
date: 2025-10-25
plugins:
  - mathjax
---

添加一段描述性文字

<!-- more -->

$$
\eta(s) = (1-2^{1-s})\zeta(s)
$$

```

## 数学公式的语法冲突

这里以 Mathjax 为例：

## Mathjax 与 Markdown 的语法冲突

MathJax 与 Markdown 的语法冲突源于两者部分符号的语义重叠，如 `_`（Markdown 斜体 vs LaTeX 下标）、`*`（Markdown 粗体 vs LaTeX 星号）和 `\`（Markdown 转义符 vs LaTeX 命令前缀）。例如，公式 `x_i` 可能被 Markdown 引擎误解析为 `<em>i</em>` 标签，导致 MathJax 无法识别。

一种方法是使用 `\` 转义这些冲突的部分符号。例如：对于多行公式中的换行 `\\` ，需要转义成 `\\\\` 。

另一种方法是逆向渲染流程，先让 MathJax 解析公式，再用 Markdown 引擎处理文本。由于理论上 MathJax 生成的 HTML 不含 Markdown 语法，可从根本上避免冲突。

还有一种方案是修改 Markdown 引擎规则，移除语义重叠的部分。 

极端的方案是直接使用图片。

## Mathjax 与 Nunjucks 的语法冲突

Nunjucks 是 Hexo 内置的模板语法。

Nunjucks 模板引擎与 MathJax 的语法冲突主要源于两者对特殊字符的解析规则重叠。

![Nunjucks](https://volantis.js.org/v6/faq/images/12.png)


符号优先级冲突：

MathJax 的 `_`（下标）和 `^`（上标）会被 Nunjucks 误认为模板语法的一部分。例如 `x_i` 可能被解析为变量 `i` 的属性，而非数学符号 `x_i` 。类似地， `\frac{1}{2}` 中的反斜杠可能被 Nunjucks 转义为普通字符，导致 MathJax 无法识别分式结构。

模板变量标识符冲突：



MathJax 的某些分隔符（如 `$$..$$` ）虽然与 Nunjucks 的 `{{ }}` 不直接重叠，但复杂公式中嵌套的大括号 `{ }` 可能触发模板引擎的语法检查错误，尤其在未正确转义时。


一种解决方法是加空格，例如在两个连续的大括号之间加入空格。

另一种解决方法是在公式前后添加 Nunjucks 的 raw 标签，使模板引擎跳过对中间内容的解析：

```yaml
{% raw %}
$$ E=mc^2 $$  <!-- 不受 Nunjucks 影响的公式 -->
{% endraw %}
```

经实验mathjax不能识别下标和时间导数的符号，也就是：

```Latex
\dot{\omega}_{x}
```

无法识别，需要使用 raw 标签处理。

这种解决方法适用于单页少量公式，无需修改全局配置。缺点是侵入式语法，降低文档可移植性。

## 图片插入
使用
```
![]()
```

插入无法调整图片大小和图片居中，使用

```
<div align="center">
   <img src="" alt="" width="30%">
</div>
```

可以调整图片大小，也可以居中。

另外， gallery 插件可以获得更好的效果，使图片可以放大和下载。

```

<div class="v-gallery">
<div align="center">
   <img src="" alt="" width="30%">
</div>
</div>

```

这时如果有多张并列的图片的话，使用

```
<div align="center" style="display: flex; justify-content: center; gap: 20px;">
  <img src="图片1路径" alt="描述1" width="45%">
  <img src="图片2路径" alt="描述2" width="45%">
</div>
```

无法调整图片大小，反而使用：

```

<div class="v-gallery v-gallery--stretch" style="--v-cols:2">
![]()
![]()
</div>

```

更好，这样可以显示: : x : :列的图片。

总结，对于单张图片：

```

<div class="v-gallery">
<div align="center">
   <img src="" alt="" width="30%">
</div>
</div>

```

对于多张图片：

```

<div class="v-gallery v-gallery--stretch" style="--v-cols:2">
![]()
![]()
...
</div>

```

gallery 插件内不能有文字。

使用

```html
<center>                   </center>
```

将图标题居中

## 小问题

有时候会出现网站页面分成两栏的情况，暂时找到了两种原因，一种是同一个文章有两个大标题，另一种是图

```
<img src="" alt="" width="30%">
```

没有闭合，也就是缺了>。

## 美观技巧

### 时间线


<div class="v-timeline">
<div class="v-timenode"><div class="v-timenode-title">第 1 步</div><div class="v-timenode-body">

这里写一下放在第一步的东西。

</div></div>



<div class="v-timenode"><div class="v-timenode-title">第二步</div><div class="v-timenode-body">

这里写一下放在第二步的东西。

</div></div>
</div>


### 块


<div class="v-noteblock t-idea is-yellow">

小提示
如何如何如何idea yellow

</div>



<div class="v-noteblock t-error is-red">

小错误
如何如何如何error red

</div>



<div class="v-noteblock is-blue">

如何如何如何blue

</div>



<div class="v-noteblock t-quote is-gold">

如何如何如何quote

</div>


```

<div class="v-noteblock t-quote is-gold">

如何如何如何quote

</div>

```



{% note  如何如何如何 %}

<div class="v-note t-info">如何如何如何 info</div>

<div class="v-note t-error">如何如何如何error</div>

<div class="v-note t-warning">如何如何如何warning</div>

<div class="v-note t-success">如何如何如何success</div>

<div class="v-note t-bug is-red">如何如何如何bug</div>

<div class="v-note t-bug">如何如何如何bug</div>

<div class="v-note is-yellow">如何如何如何radiation</div>

<div class="v-note">如何如何如何play</div>

<div class="v-note t-quote">如何如何如何quote</div>

```
<div class="v-note t-quote">如何如何如何quote</div>
```



### 折叠


<details class="v-folding is-green"><summary>Tips: volantis</summary><div class="v-folding-body">

<div class="v-note t-info">volantis 开发</div>

<div class="v-note t-bug t-danger">volantis 开发</div>

</div></details>


```

<details class="v-folding is-green"><summary>Tips: volantis</summary><div class="v-folding-body">

<div class="v-note t-info">volantis 开发</div>

<div class="v-note t-bug t-danger">volantis 开发</div>

</div></details>

```

{%folding%}

1

2

3

4

5

6

7

{%endfolding%}

### 嵌入MP3/4

{% video ./assets/demo.mp4, width=100% %}

```
{% video ./assets/demo.mp4, width=100% %}
```

{% audio ./assets/demo.mp3，width=100% %}

```
{% audio ./assets/demo.mp3，width=100% %}
```



### 卡片链接

<a class="v-link" href="https://volantis.js.org/v7/getting-started/" target="_blank" rel="noopener"><img class="v-link-icon" src="https://unpkg.com/volantis-static@0.0.1649552113628/media/twemoji/assets/svg/1f433.svg" alt="" loading="lazy"><span class="v-link-title">示例博客</span></a>

```
<a class="v-link" href="https://volantis.js.org/v7/getting-started/" target="_blank" rel="noopener"><img class="v-link-icon" src="https://unpkg.com/volantis-static@0.0.1649552113628/media/twemoji/assets/svg/1f433.svg" alt="" loading="lazy"><span class="v-link-title">示例博客</span></a>
```



### 标题

<p>
<span class="v-span vs-logo vs-center vs-large"><sup>&ensp;</sup>Volantis<sup>7</sup></span>
<span class="v-span vs-center vs-small vs-logo">A Wonderful Theme for Hexo</span>
</p>
<br>

写作：

```
<p>
<span class="v-span vs-logo vs-center vs-large"><sup>&ensp;</sup>Volantis<sup>7</sup></span>
<span class="v-span vs-center vs-small vs-logo">A Wonderful Theme for Hexo</span>
</p>
<br>
```

### 分栏


<div class="v-tabs"><div class="v-tabs-nav"><button class="v-tabs-tab is-active" data-vtab="0" type="button">第一个</button><button class="v-tabs-tab" data-vtab="1" type="button">第二个</button></div><div class="v-tabs-pane is-active" data-vtab-pane="0">

如何如何如何1

</div>
<div class="v-tabs-pane" data-vtab-pane="1">

如何如何如何2

</div></div>


```

<div class="v-tabs"><div class="v-tabs-nav"><button class="v-tabs-tab is-active" data-vtab="0" type="button">第一个</button><button class="v-tabs-tab" data-vtab="1" type="button">第二个</button></div><div class="v-tabs-pane is-active" data-vtab-pane="0">

如何如何如何1

</div>
<div class="v-tabs-pane" data-vtab-pane="1">

如何如何如何2

</div></div>

```



### 按钮

<a class="v-btn" href="https://volantis.js.org/v7/getting-started/" target="_blank" rel="noopener">按钮</a> 

```
<a class="v-btn" href="https://volantis.js.org/v7/getting-started/" target="_blank" rel="noopener">按钮</a> 
```

### 链接

[volantis](https://volantis.js.org/v7/getting-started/)

### 文字

{% emp 着重文字 %} 
{% wavy 波浪线文字 %} 
{% del 删除线文字 %}
{% u 下划线文字 %} 

<u>这里有下划线</u>

```
{% emp 着重文字 %} 
{% wavy 波浪线文字 %} 
{% del 删除线文字 %}
{% u 下划线文字 %} 

<u>这里有下划线</u>
```



### 注音下标

<ruby>基字<rt>注音</rt></ruby>

<sup>上标内容</sup>
 <sub>下标内容</sub>

```
基字注音<ruby>基字<rt>注音</rt></ruby>
<sup>上标内容</sup>
 <sub>下标内容</sub>
```

