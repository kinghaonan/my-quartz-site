// 目录跟随：正文滚到哪儿，右侧「目录」就把当前小节留在可见范围内。
// Quartz 只给命中的条目加 .in-view，不管滚动；列表改成内部滚动后就露馅了——
// 高亮项常常在滚动区外面，看起来像「目录显示不全」。
;(function () {
  var MARGIN = 24

  function follow(ul) {
    // Quartz 给「已经越过的小节」都加 .in-view（不是只给当前一节），
    // 所以当前小节是文档顺序里最后一个 .in-view。
    var all = ul.querySelectorAll("li > a.in-view")
    var active = all.length ? all[all.length - 1] : null
    if (!active) return
    var u = ul.getBoundingClientRect()
    var a = active.getBoundingClientRect()
    if (a.top < u.top + MARGIN) {
      ul.scrollTop -= u.top + MARGIN - a.top
    } else if (a.bottom > u.bottom - MARGIN) {
      ul.scrollTop += a.bottom - (u.bottom - MARGIN)
    }
  }

  function watch(ul) {
    if (ul.__tocFollow) return
    ul.__tocFollow = new MutationObserver(function () {
      follow(ul)
    })
    ul.__tocFollow.observe(ul, { subtree: true, attributes: true, attributeFilter: ["class"] })
    follow(ul)
  }

  function setup() {
    document.querySelectorAll("ul.toc-content").forEach(watch)
  }

  document.addEventListener("DOMContentLoaded", setup)
  // SPA 换页后重新挂
  window.addEventListener("nav", setup)
  window.addEventListener("render", setup)
})()
