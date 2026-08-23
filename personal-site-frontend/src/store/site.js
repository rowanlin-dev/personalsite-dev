import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getAbout, getContact, getResume, getAvatar } from '../api/config'
import { getProjectAll } from '../api/project'
import { getTechMapData, getTagCloud } from '../api/tag'
import { getTechRelations } from '../api/skill'

/**
 * 站点公共数据缓存 Store。
 *
 * 配置、项目、技术栈图谱等变更频率很低，首次加载后缓存到 Pinia，
 * 配合 keep-alive 可大幅削减切换页面时的重复请求。
 */
export const useSiteStore = defineStore('site', () => {
  // ---------- 原始配置（扁平 key-value） ----------
  const rawConfig = ref({})
  const configLoaded = ref(false)

  // ---------- 项目 ----------
  const projects = ref([])
  const projectsLoaded = ref(false)

  // ---------- 技术栈图谱 ----------
  const skills = ref([])
  const skillsLoaded = ref(false)
  // 方案 C：后台手动配置的技术栈关系（同类/协作/依赖/增强）
  const techRelations = ref([])
  const techRelationsLoaded = ref(false)

  // ---------- 标签云 ----------
  const tags = ref([])
  const tagsLoaded = ref(false)

  // ---------- 计算属性：前端需要的结构化配置 ----------
  const about = computed(() => ({
    title: rawConfig.value.about_title || '',
    content: rawConfig.value.about_content || ''
  }))

  const contact = computed(() => ({
    email: rawConfig.value.contact_email || '',
    github: rawConfig.value.contact_github || '',
    wechat: rawConfig.value.contact_wechat || ''
  }))

  const resume = computed(() => ({
    enable: rawConfig.value.resume_enable === '1',
    pdf: rawConfig.value.resume_pdf || ''
  }))

  const avatar = computed(() => ({
    url: rawConfig.value.avatar_url || '',
    show: rawConfig.value.avatar_show !== '0'
  }))

  // ---------- actions ----------
  async function loadConfig(force = false) {
    if (configLoaded.value && !force) return

    // 并发加载公开配置分片（均已在后端 LoginInterceptor 白名单内，访客可访问）。
    // 不再调用需登录的 /config/all（含敏感全量快照），改为拼装以下公开接口，
    // 并把结果映射成与 computed 解析逻辑一致的扁平 rawConfig 字段：
    //   getAbout   -> about_title / about_content
    //   getContact -> contact_email / contact_github / contact_wechat
    //   getResume  -> resume_enable / resume_pdf
    //   getAvatar  -> avatar_url / avatar_show
    // 每个分片单独 try/catch，单接口失败不影响其它分片与首页渲染。
    const raw = {}
    const safeGet = async (fn, mapper) => {
      try {
        const res = await fn()
        mapper(res?.data || {}, raw)
      } catch (e) {
        console.warn('[site] 加载公开配置分片失败，已跳过', e)
      }
    }

    await Promise.all([
      safeGet(getAbout, (d, raw) => {
        raw.about_title = d.title ?? ''
        raw.about_content = d.content ?? ''
      }),
      safeGet(getContact, (d, raw) => {
        raw.contact_email = d.email ?? ''
        raw.contact_github = d.github ?? ''
        raw.contact_wechat = d.wechat ?? ''
      }),
      safeGet(getResume, (d, raw) => {
        raw.resume_enable = d.enable ? '1' : '0'
        raw.resume_pdf = d.url ?? d.pdf ?? ''
      }),
      safeGet(getAvatar, (d, raw) => {
        raw.avatar_url = d.url ?? ''
        raw.avatar_show = d.show === false ? '0' : '1'
      })
    ])

    rawConfig.value = raw
    configLoaded.value = true
  }

  async function loadProjects(force = false) {
    if (projectsLoaded.value && !force) return
    const res = await getProjectAll()
    projects.value = res.data || []
    projectsLoaded.value = true
  }

  async function loadSkills(force = false) {
    if (skillsLoaded.value && !force) return
    const [skillRes, relRes] = await Promise.all([
      getTechMapData(),
      getTechRelations().catch(() => ({ data: [] }))
    ])
    skills.value = skillRes.data || []
    techRelations.value = relRes.data || []
    skillsLoaded.value = true
    techRelationsLoaded.value = true
  }

  async function loadTags(force = false) {
    if (tagsLoaded.value && !force) return
    const res = await getTagCloud()
    tags.value = res.data || []
    tagsLoaded.value = true
  }

  /**
   * 清空缓存，用于后台修改配置/项目后重新加载。
   */
  function clearCache() {
    rawConfig.value = {}
    configLoaded.value = false
    projects.value = []
    projectsLoaded.value = false
    skills.value = []
    skillsLoaded.value = false
    tags.value = []
    tagsLoaded.value = false
  }

  return {
    rawConfig,
    configLoaded,
    projects,
    projectsLoaded,
    skills,
    skillsLoaded,
    techRelations,
    techRelationsLoaded,
    tags,
    tagsLoaded,
    about,
    contact,
    resume,
    avatar,
    loadConfig,
    loadProjects,
    loadSkills,
    loadTags,
    clearCache
  }
})
