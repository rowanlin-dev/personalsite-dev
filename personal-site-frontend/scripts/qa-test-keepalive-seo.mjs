/**
 * qa-test-keepalive-seo.mjs —— keep-alive 下 onMounted/onActivated 时序验证
 * ===========================================================================
 * 【被测对象】src/views/ArticleDetail.vue 的数据加载 + SEO 写入时序
 *
 * 【根因回顾（BUG-1，已修复）】
 * 组件位于 <keep-alive> 内时，首次挂载 Vue 会「先 mounted 后 activated」，
 * 且二者在同一次 post-flush 中同步依次调用。由于 onMounted 回调是 async，
 * 它在第一个 await 处让出后 activated 立即执行，此时 loadedId 仍为 null，
 * 旧守卫 `String(id) !== loadedId.value` 成立 -> 触发第二次 loadArticle。
 * 后果：首次进入文章页请求翻倍（5 -> 10），且后端 getDetail() 每次调用都会
 * increaseViewCount，导致线上浏览量被永久按 2 倍统计。
 *
 * 【修复方案】新增同步写入的 loadingId 标记，在「第一个 await 之前」就置位，
 * 关闭 mounted/activated 之间的竞态窗口。详见 ArticleDetail.vue 注释。
 *
 * 【为什么用自定义渲染器】沙箱无 jsdom/vitest，但 @vue/runtime-core 可用。
 * 用 createRenderer 造一个无 DOM 的测试渲染器，即可跑真实的 KeepAlive 逻辑与
 * 真实的生命周期调度，结论等价于浏览器，且不依赖任何测试框架。
 *
 * 用法：node scripts/qa-test-keepalive-seo.mjs
 * ===========================================================================
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  createRenderer,
  defineComponent,
  h,
  ref,
  onMounted,
  onActivated,
  KeepAlive,
  nextTick
} from '@vue/runtime-core'

/* -------------------------------------------------------------------------- */
/* 极简测试渲染器（无 DOM）                                                     */
/* -------------------------------------------------------------------------- */

const nodeOps = {
  createElement: (tag) => ({ tag, children: [], parent: null }),
  createText: (text) => ({ text }),
  createComment: (text) => ({ comment: text }),
  setText: (node, text) => { node.text = text },
  setElementText: (el, text) => { el.children = [text] },
  insert: (child, parent) => { child.parent = parent; parent.children.push(child) },
  remove: (child) => {
    const p = child.parent
    if (p) p.children.splice(p.children.indexOf(child), 1)
  },
  parentNode: (node) => node.parent || null,
  nextSibling: () => null,
  querySelector: () => null,
  setScopeId: () => {},
  patchProp: () => {}
}

const { createApp } = createRenderer(nodeOps)

/* -------------------------------------------------------------------------- */
/* 断言工具                                                                     */
/* -------------------------------------------------------------------------- */

let failures = 0
let passes = 0

function assertEqual(actual, expected, label) {
  if (actual === expected) {
    passes += 1
    console.log(`  PASS  ${label}  (= ${JSON.stringify(actual)})`)
  } else {
    failures += 1
    console.log(`  FAIL  ${label}  期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`)
  }
}

/** 把调度队列与微任务彻底跑干净 */
async function settle() {
  for (let i = 0; i < 20; i += 1) await nextTick()
}

/* -------------------------------------------------------------------------- */
/* 被测组件工厂                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * 构造一个复刻 ArticleDetail.vue 加载逻辑的组件。
 *
 * @param {object}  options
 * @param {'fixed'|'legacy'} options.impl      使用修复后写法还是旧写法
 * @param {import('vue').Ref<string>} options.routeId 模拟 route.params.id
 * @param {object}  options.counters           计数器容器（loadCount / seoCount）
 * @param {(id: string) => boolean} [options.shouldFail] 指定哪次加载应失败
 * @returns {import('vue').Component}
 */
function makeArticleDetail({ impl, routeId, counters, shouldFail = () => false }) {
  return defineComponent({
    name: 'ArticleDetail',
    setup() {
      const article = ref(null)
      const loadedId = ref(null)
      let loadingId = null

      /** 模拟 Promise.all([...5 个接口]) 的异步等待与赋值 */
      const doLoad = async (id, key) => {
        counters.loadCount += 1
        await Promise.resolve()
        await Promise.resolve()
        if (shouldFail(String(id))) throw new Error('模拟接口失败 ' + id)
        article.value = { id: String(id), title: 'T' + id }
        loadedId.value = key
        counters.seoCount += 1 // setArticleSeo(article.value)
      }

      const loadArticleFixed = async (id) => {
        const key = String(id)
        if (loadingId === key) return          // 同步守卫，必须在任何 await 之前
        loadingId = key
        try {
          await doLoad(id, key)
        } finally {
          if (loadingId === key) loadingId = null
        }
      }

      const loadArticleLegacy = async (id) => {
        await doLoad(id, String(id))
      }

      const loadArticle = impl === 'fixed' ? loadArticleFixed : loadArticleLegacy

      const loadArticleSafely = async (id) => {
        try {
          await loadArticle(id)
        } catch {
          /* 错误提示由 request.js 拦截器负责，这里静默 */
        }
      }

      onMounted(async () => {
        await loadArticleSafely(routeId.value)
      })

      onActivated(async () => {
        const id = routeId.value
        if (!id) return

        if (impl === 'legacy') {
          if (String(id) !== loadedId.value) {
            article.value = null
            await loadArticleSafely(id)
          } else if (article.value) {
            counters.seoCount += 1
          }
          return
        }

        const key = String(id)
        if (key === loadedId.value) {
          if (article.value) counters.seoCount += 1 // setArticleSeo
          return
        }
        if (key === loadingId) return              // mounted 正在加载同一篇
        article.value = null
        await loadArticleSafely(id)
      })

      return () => h('div', null, 'article')
    }
  })
}

const OtherPage = defineComponent({
  name: 'OtherPage',
  setup: () => () => h('div', null, 'other')
})

/**
 * 挂载一个 KeepAlive 容器，并返回用于切换页面的句柄。
 *
 * @param {import('vue').Component} ArticleDetailLike
 * @returns {{ show: import('vue').Ref<string> }}
 */
function mountWithKeepAlive(ArticleDetailLike) {
  const show = ref('article')
  const Root = defineComponent({
    setup() {
      return () =>
        h(KeepAlive, { include: ['ArticleDetail', 'OtherPage'] }, [
          show.value === 'article' ? h(ArticleDetailLike) : h(OtherPage)
        ])
    }
  })
  createApp(Root).mount(nodeOps.createElement('root'))
  return { show }
}

/* -------------------------------------------------------------------------- */
/* 用例 1：修复后写法 —— 首次挂载只能加载 1 次（BUG-1 回归）                     */
/* -------------------------------------------------------------------------- */

async function testFixedFirstMount() {
  console.log('\n[用例1] 修复后写法：keep-alive 内首次挂载')
  const counters = { loadCount: 0, seoCount: 0 }
  const routeId = ref('1')
  mountWithKeepAlive(makeArticleDetail({ impl: 'fixed', routeId, counters }))
  await settle()

  console.log(`  实测 loadArticle 实际发起加载次数 = ${counters.loadCount}`)
  console.log(`  实测 setArticleSeo 调用次数 = ${counters.seoCount}`)
  assertEqual(counters.loadCount, 1, '首次挂载应只加载 1 次（每多 1 次 = 多 5 个请求 + 浏览量多记 1）')
  assertEqual(counters.seoCount, 1, '首次挂载应只写入 1 次 SEO')
}

/* -------------------------------------------------------------------------- */
/* 用例 2：对照组 —— 旧写法必须仍然复现 2 次（证明本测试有辨别力）                */
/* -------------------------------------------------------------------------- */

async function testLegacyStillReproduces() {
  console.log('\n[用例2] 对照组：旧写法（无同步守卫）应仍能复现 BUG-1')
  const counters = { loadCount: 0, seoCount: 0 }
  const routeId = ref('1')
  mountWithKeepAlive(makeArticleDetail({ impl: 'legacy', routeId, counters }))
  await settle()

  console.log(`  实测 loadArticle 调用次数 = ${counters.loadCount}`)
  assertEqual(counters.loadCount, 2, '旧写法应复现 2 次加载（若此项变 1，说明测试已失去辨别力）')
}

/* -------------------------------------------------------------------------- */
/* 用例 3：Vue 生命周期时序探针 —— 记录并锁定根因                                */
/* -------------------------------------------------------------------------- */

async function testHookOrder() {
  console.log('\n[用例3] 根因探针：keep-alive 首挂时 mounted / activated 的时序')

  const order = []
  let loadedIdAtActivated = 'UNSET'

  const Probe = defineComponent({
    name: 'Probe',
    setup() {
      const loadedId = ref(null)
      onMounted(async () => {
        order.push('mounted:start')
        await Promise.resolve()
        loadedId.value = 'done'
        order.push('mounted:end')
      })
      onActivated(() => {
        order.push('activated')
        loadedIdAtActivated = loadedId.value
      })
      return () => h('div')
    }
  })

  const Root = defineComponent({ setup: () => () => h(KeepAlive, null, [h(Probe)]) })
  createApp(Root).mount(nodeOps.createElement('root'))
  await settle()

  console.log(`  实际调用顺序: ${order.join(' -> ')}`)
  console.log(`  activated 执行时 loadedId = ${JSON.stringify(loadedIdAtActivated)}`)
  // 这是 Vue 的固有行为，不是缺陷：activated 一定发生在 mounted 的 await 让出之后、
  // 其异步赋值完成之前。锁定该行为，任何依赖「异步赋值结果」做守卫的写法都是错的。
  assertEqual(
    loadedIdAtActivated,
    null,
    '根因成立：activated 执行时 mounted 的异步赋值尚未完成，故守卫必须同步置位'
  )
  assertEqual(
    order.join(' -> '),
    'mounted:start -> activated -> mounted:end',
    '生命周期时序符合预期'
  )
}

/* -------------------------------------------------------------------------- */
/* 用例 4：切换到另一篇文章时必须重新加载（不能被守卫误挡）                       */
/* -------------------------------------------------------------------------- */

async function testSwitchArticle() {
  console.log('\n[用例4] keep-alive 复用实例：/article/1 -> /article/2 应重新加载')
  const counters = { loadCount: 0, seoCount: 0 }
  const routeId = ref('1')
  const { show } = mountWithKeepAlive(makeArticleDetail({ impl: 'fixed', routeId, counters }))
  await settle()
  assertEqual(counters.loadCount, 1, '首屏加载 1 次')

  // 离开本页 -> 切到另一篇文章 -> 回到本页（模拟 keep-alive 的 deactivate/activate）
  show.value = 'other'
  await settle()
  routeId.value = '2'
  show.value = 'article'
  await settle()

  console.log(`  切换后累计加载次数 = ${counters.loadCount}`)
  assertEqual(counters.loadCount, 2, '切换到新文章应触发第 2 次加载')
  assertEqual(counters.seoCount, 2, '新文章应写入新的 SEO')
}

/* -------------------------------------------------------------------------- */
/* 用例 5：返回同一篇文章不重复请求，但必须补写 SEO                              */
/* -------------------------------------------------------------------------- */

async function testReturnSameArticle() {
  console.log('\n[用例5] 返回同一篇文章：不重复请求，但要补回被 afterEach 重置的 SEO')
  const counters = { loadCount: 0, seoCount: 0 }
  const routeId = ref('1')
  const { show } = mountWithKeepAlive(makeArticleDetail({ impl: 'fixed', routeId, counters }))
  await settle()

  show.value = 'other'
  await settle()
  show.value = 'article' // id 未变
  await settle()

  console.log(`  累计加载次数 = ${counters.loadCount}，累计 SEO 写入 = ${counters.seoCount}`)
  assertEqual(counters.loadCount, 1, '同一篇文章不应重复请求')
  assertEqual(counters.seoCount, 2, '需补写 1 次 SEO（afterEach 已把 meta 重置为占位值）')
}

/* -------------------------------------------------------------------------- */
/* 用例 6：加载失败后守卫必须被清理，允许重试                                    */
/* -------------------------------------------------------------------------- */

async function testRetryAfterFailure() {
  console.log('\n[用例6] 首次加载失败后，再次进入本页应能重试（loadingId 已清理）')
  const counters = { loadCount: 0, seoCount: 0 }
  const routeId = ref('1')
  let failNext = true
  const Comp = makeArticleDetail({
    impl: 'fixed',
    routeId,
    counters,
    shouldFail: () => {
      if (failNext) { failNext = false; return true }
      return false
    }
  })
  const { show } = mountWithKeepAlive(Comp)
  await settle()
  assertEqual(counters.loadCount, 1, '首次加载发起 1 次（失败）')
  assertEqual(counters.seoCount, 0, '失败时不应写入 SEO')

  show.value = 'other'
  await settle()
  show.value = 'article'
  await settle()

  console.log(`  重试后累计加载次数 = ${counters.loadCount}`)
  assertEqual(counters.loadCount, 2, '失败后应允许重试，而不是被 loadingId 永久挡住')
  assertEqual(counters.seoCount, 1, '重试成功后写入 SEO')
}

/* -------------------------------------------------------------------------- */
/* 用例 7：把结论绑定到「真实源文件」，防止复刻件与产品代码脱节                   */
/* -------------------------------------------------------------------------- */

/**
 * 用例 1-6 跑的是真实 Vue 调度，但被测体是本文件内的复刻组件
 * （makeArticleDetail）。这带来一个盲区：**复刻件写对了不等于
 * src/views/ArticleDetail.vue 写对了** —— 如果产品代码被回退、或今后有人
 * 重构时把同步守卫挪到 await 之后，用例 1-6 依然全绿，属于典型的假通过。
 *
 * 因此这里直接解析真实源文件，核验修复确实落在产品代码上：
 *   a) loadArticle 在第一个 await 之前有同步守卫赋值
 *   b) 该守卫在 onActivated 中被引用
 *   c) 守卫在 finally 中被清理（保证失败后可重试）
 *   d) 守卫不是 ref（ref 的 .value 赋值同样同步，故此项仅作提示，不判失败）
 */
async function testRealSourceGuard() {
  console.log('\n[用例7] 真实源文件 src/views/ArticleDetail.vue 守卫结构核验')

  // 允许用 QA_ARTICLE_DETAIL_PATH 指向替代文件，便于做「变异测试」：
  // 用旧版有 Bug 的代码跑一遍，确认本用例确实会 FAIL（即本检测有辨别力）。
  const srcPath =
    process.env.QA_ARTICLE_DETAIL_PATH ||
    path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'views', 'ArticleDetail.vue')
  const src = fs.readFileSync(srcPath, 'utf8')

  // 定位 loadArticle 函数体：从声明处到 `\n}` 收尾
  const fnMatch = src.match(/const\s+loadArticle\s*=\s*async\s*\([^)]*\)\s*=>\s*\{([\s\S]*?)\n\}/)
  if (!fnMatch) {
    failures += 1
    console.log('  FAIL  未能定位 loadArticle 函数，源文件结构可能被大改，请人工复核')
    return
  }
  // 必须先剥掉注释再做分析：源码注释里就写着「必须位于第一个 await 之前」，
  // 若不剥离，indexOf('await') 会命中注释中的 await，把 head 截断在守卫之前，
  // 从而误报「没有守卫」。（本轮首次运行即踩到该假失败，已修正。）
  const stripComments = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

  const body = stripComments(fnMatch[1])
  const firstAwait = body.indexOf('await')
  const head = firstAwait >= 0 ? body.slice(0, firstAwait) : body

  // a) 第一个 await 之前必须有同步守卫赋值。
  //    注意：必须排除 `const key = String(id)` 这类「函数内新声明的局部变量」——
  //    它们每次调用都是全新的，起不到跨调用去重的作用。真正的守卫必须是
  //    赋值给「函数外部（setup 作用域）已声明」的变量，即不带 const/let/var 的裸赋值。
  //    首轮此处正则写松了，误把 `const key =` 当成守卫导致假通过，现已收紧。
  const declaredLocals = new Set(
    [...head.matchAll(/\b(?:const|let|var)\s+(\w+)/g)].map((m) => m[1])
  )
  let guardName = null
  let guardLine = ''
  for (const rawLine of head.split('\n')) {
    const line = rawLine.trim()
    if (/^(?:const|let|var)\b/.test(line)) continue        // 跳过声明语句
    const m = line.match(/^(\w+)(\.value)?\s*=\s*(?!=)/)   // 裸赋值
    if (m && !declaredLocals.has(m[1])) {
      guardName = m[1]
      guardLine = line
      break
    }
  }
  console.log(`  第一个 await 之前的外部变量赋值: ${guardLine || '(无)'}`)
  console.log(`  （已排除的函数内局部声明: ${[...declaredLocals].join(', ') || '无'}）`)
  assertEqual(
    !!guardName,
    true,
    '(a) loadArticle 在第一个 await 之前同步置位「跨调用可见」的守卫'
  )
  if (!guardName) return

  // b) onActivated 必须引用该守卫，否则守卫形同虚设。
  //    同样要剥注释 —— 注释里提到 loadingId 不代表代码真的用了它。
  const activatedRaw = src.match(/onActivated\s*\(\s*async[\s\S]*?\n\}\)/)
  const activatedCode = activatedRaw ? stripComments(activatedRaw[0]) : ''
  assertEqual(
    new RegExp(`\\b${guardName}\\b`).test(activatedCode),
    true,
    `(b) onActivated 的代码（非注释）中引用了守卫变量 ${guardName}`
  )

  // c) finally 中清理守卫本身（必须是同一个变量名，不能是任意 = null）
  const hasFinallyReset = new RegExp(`finally\\s*\\{[\\s\\S]*?\\b${guardName}\\s*=\\s*null`).test(body)
  assertEqual(hasFinallyReset, true, `(c) finally 中清理守卫 ${guardName}，失败后可重试`)

  // d) 旧的「仅凭 loadedId 判断」的裸守卫不应再作为唯一防线
  const legacyOnlyGuard =
    /String\(id\)\s*!==\s*loadedId\.value/.test(activatedCode) &&
    !new RegExp(`\\b${guardName}\\b`).test(activatedCode)
  assertEqual(legacyOnlyGuard, false, '(d) 旧的裸 loadedId 守卫未残留为唯一防线')
}

/* -------------------------------------------------------------------------- */

console.log('=== ArticleDetail keep-alive 时序验证（BUG-1 回归） ===')
await testFixedFirstMount()
await testLegacyStillReproduces()
await testHookOrder()
await testSwitchArticle()
await testReturnSameArticle()
await testRetryAfterFailure()
await testRealSourceGuard()

console.log(`\n合计: 通过 ${passes}，失败 ${failures}`)
process.exit(failures ? 1 : 0)
