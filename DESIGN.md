---
name: Quiz 科学答题
description: 课时路线——清楚、平静、适合课堂触控的科学练习界面。
colors:
  navy: "#1c3155"
  blue: "#2454ce"
  orange: "#f4b545"
  muted: "#56647b"
  line: "#dce3ec"
  ink: "#142337"
  cool-white: "#f4f7fb"
  white: "#ffffff"
  action-ink: "#30220e"
  orange-hover: "#e9a329"
  mode-rest: "#eef1f7"
  nav-hover: "#2a4166"
  field-border: "#b7c3d3"
  secondary-border: "#a9b8cc"
  focus: "#376edc"
  preview-fill: "#fff1ce"
  preview-ink: "#67440d"
  player-orange: "#86500b"
  player-orange-progress: "#bf7b14"
  success: "#217554"
  success-fill: "#ebf6ee"
  success-border: "#278052"
  error: "#9b3025"
  error-fill: "#fff0ed"
  selected-answer: "#e4ecff"
typography:
  headline:
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: "clamp(28px, 2.8vw, 38px)"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  title:
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.75
  label:
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: "14px"
    fontWeight: 400
  question:
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: "23px"
    fontWeight: 600
    lineHeight: 1.8
  action:
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: "18px"
    fontWeight: 700
  timer:
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", system-ui, sans-serif'
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 1.2
rounded:
  tag: "5px"
  field: "8px"
  answer: "9px"
  action: "10px"
  record: "14px"
  sheet: "16px"
spacing:
  space-6: "6px"
  space-8: "8px"
  space-10: "10px"
  space-12: "12px"
  space-14: "14px"
  space-16: "16px"
  space-18: "18px"
  space-20: "20px"
  space-22: "22px"
  space-24: "24px"
  space-28: "28px"
  space-32: "32px"
  space-36: "36px"
  space-48: "48px"
components:
  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.action-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.action}"
    padding: "14px 22px"
  button-primary-hover:
    backgroundColor: "{colors.orange-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.navy}"
    rounded: "{rounded.field}"
    padding: "11px 16px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.blue}"
    padding: "10px 2px"
  input:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
    width: "100%"
  navigation:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
  preview-tag:
    backgroundColor: "{colors.preview-fill}"
    textColor: "#714d12"
    rounded: "{rounded.tag}"
    padding: "4px 8px"
  sheet:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "26px 24px"
  lesson-row:
    backgroundColor: "{colors.white}"
    textColor: "{colors.ink}"
    padding: "18px 8px"
  mode:
    backgroundColor: "{colors.mode-rest}"
    textColor: "{colors.navy}"
    rounded: "{rounded.field}"
    padding: "12px 6px"
  mode-selected:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.white}"
  answer-option:
    backgroundColor: "{colors.cool-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.answer}"
    padding: "14px 16px"
  answer-option-chosen:
    backgroundColor: "{colors.selected-answer}"
  answer-option-correct:
    backgroundColor: "{colors.success-fill}"
---

# Design System: Quiz 科学答题

## Overview

**Creative North Star: "课时路线"**

Quiz 用沉稳的深蓝建立方向，用白色工作区域承载可选择的内容，以暖橙色突出下一步行动。界面面向课堂电脑、平板与同屏作答：先看清内容和当前状态，再完成操作。中文短句、标准控件和足够的触控面积构成它的日常语气。

视觉秩序来自文字层级、间距、分隔线与色块。按钮和容器保持平面，轮廓适度圆润；图标使用 Phosphor SVG 配合文字。当前记录提取自本地开发预览的实际 CSS 与 React 组件，描述已实现的视觉系统，不代表真实题源已验证或产品已经公开发布。

**Key Characteristics:**

- 深蓝导航、冷白画布、白色工作区域与暖橙行动按钮。
- 用户确认的中文系统无衬线，标题与正文共用字族。
- 标准表单、清楚的选中状态与适合触控的行高。
- 双方以姓名、左右位置和蓝橙色共同区分。
- 状态切换短暂淡入，减少动态时停止动画。

## Colors

冷静的中性色承载内容，深蓝负责方向，暖橙负责推进，语义色只在相关状态中出现。规范值以 frontmatter 为准。

### Primary

- **课堂深蓝**（`navy`）：顶栏、当前单元、选中的练习方式、复选框和范围摘要。
- **行动暖橙**（`orange`、`orange-hover`）：主要行动的默认和悬停背景；文字使用深棕色 `action-ink`，顶栏当前入口的下划线也使用暖橙。

### Secondary

- **作答蓝**（`blue`）：文字操作、链接、左侧玩家标题和进度。
- **同伴赭橙**（`player-orange`、`player-orange-progress`）：右侧玩家标题与进度；标题色比进度色更深，以保证白底文字清晰。

### Neutral

- **冷白画布**（`cool-white`）与 **工作白**（`white`）：页面背景与工作区域，靠色差建立区域边界。
- **深墨正文**（`ink`）与 **说明灰蓝**（`muted`）：正文和辅助说明。辅助说明仍需完整可读。
- **雾蓝分隔**（`line`）、**表单边框**（`field-border`）与 **次要操作边框**（`secondary-border`）：分隔与可操作轮廓。
- **方式浅底**（`mode-rest`）与 **导航悬停蓝**（`nav-hover`）：未选方式与顶栏悬停状态。

成功使用 `success`、`success-fill` 与 `success-border`；错误使用 `error` 与 `error-fill`。`preview-fill` 配合深色文字明确提示开发样题。已提交答案使用 `selected-answer` 标记选择，正确答案另外使用成功色和答案文字。

**The State Has Words Rule.** 颜色必须伴随姓名、位置、文字、复选标记或进度数值；不让颜色单独承担身份和答案状态。

## Typography

**Display Font:** 无独立装饰字族；页面功能标题与正文共用已确认的中文系统无衬线。

**Body Font:** PingFang SC → Microsoft YaHei → Noto Sans CJK SC → system-ui → sans-serif。

**Character:** 字形清楚、节奏平稳，粗细承担层级。没有外部字体请求；中英文、昵称、题目与数据保持一致的阅读语气。

### Hierarchy

- **Headline**：页面标题采用流动字号 `headline`；练习页标题收敛到桌面（28px）与窄屏（25px）。
- **Title**：区域标题采用 `title`；玩家标题使用（20px），窄屏双人标题为（16px）。
- **Body**：正文采用 `body`，说明段落的行高为（1.75）；介绍文字最长（65ch）。课时行和桌面选项文字为（18px）。
- **Label**：表单标签采用 `label`；课时序号、题型、保存状态等辅助文字通常为（12–14px），不使用装饰性眉题。
- **Question**：桌面题干采用 `question`；中屏为（21px），窄屏双人为（17px），维持宽松行高。
- **Action**：主要按钮采用 `action`。计时采用 `timer`，窄屏为（28px）；分数和计时使用等宽数字排布。

**The One Reading Voice Rule.** 功能标题、正文和操作共用用户确认的中文系统无衬线，通过字号、字重和间距区分职责。

## Layout

布局先保证内容与操作都能看清。主要工作区居中，选课与练习页面最大宽度（1440px）；成绩结果为（1000px），历史为（1100px），准备完成状态为（760px）。正文不被强制放进同一种卡片模板。

桌面选课采用导航、内容、设置三栏，列宽分别为（230px / 弹性 / 300px），间距（36px）。在（1250px）及以下压缩外边距与栏宽；在（1000px）及以下改为两栏，设置排在内容下方；在（650px）及以下顺序排列，单元导航横向展开，页面水平留白通常为（20px）。这些是已实现的响应式规则，不要求其他页面复制三栏结构。

双人答题始终以两列维持左右身份，桌面列间距（32px），随后缩至（24px）和（12px）。单人答题内容最大宽度（800px）。窄屏双人界面显示横屏建议，压缩内边距与文字；平板及以下隐藏键盘提示。

间距来自紧凑的（6–12px）内部配合、常用的（18–28px）内容间距与更宽的（32–48px）区域间距。长昵称、课时范围和题干允许换行。当前页面最低布局宽度为（340px）。

## Elevation & Depth

当前系统没有投影、渐变或悬浮层。深蓝导航提供稳定锚点，白色容器与冷白页面提供区域深度，浅色边框提供表单和答案的轮廓。交互反馈来自颜色、描边和下划线，不使用位置跳动。

**The Flat Task Rule.** 课堂任务控件以平面色块和清楚轮廓表达状态，不为已有按钮或工作区域添加装饰性投影。

## Shapes

轮廓柔和但保持标准控件的辨识度：标签使用 `tag`，输入和次要按钮使用 `field`，答案使用 `answer`，主要按钮和单元入口使用 `action`，历史记录使用 `record`，工作区域和作答面板使用 `sheet`。表单、答案和次要按钮采用细描边（1px）；顶栏当前入口采用底边（3px）。不将任务按钮做成胶囊。

## Components

### Buttons

主要按钮坚定、平直，以暖橙背景与深色文字推动下一步。形状、颜色和内边距使用 `button-primary`，最小高度（54px），图标与文字间距（12px）；悬停使用 `button-primary-hover`。次要按钮使用透明背景、深蓝文字和细边框，最小高度（44px）；文字按钮最小高度同为（44px），悬停时加下划线。禁用按钮降低不透明度（0.55）。

按钮只对背景色和文字颜色作（160ms ease-out）过渡。所有按钮、输入、选择框和折叠摘要在键盘聚焦时显示（3px）轮廓，偏移（4px）；深蓝顶栏内轮廓改用暖橙，其余使用 `focus`。

### Chips

开发样题标签是紧凑的状态标记，使用 `preview-tag`，字号（11px）。它表达内容来源状态，不作为筛选控件，也不占用标题上方的装饰位置。

### Cards / Containers

白色工作区域没有阴影。设置区采用 `sheet` 的标准内边距；课时区为（26px 28px 8px），作答面板为（28px），成绩面板为（24px）。历史记录使用更紧凑的 `record` 圆角。中屏与窄屏按既有媒体查询减少内边距。

### Inputs / Fields

输入和选择框使用白底、深墨文字、`field-border` 细边框及 `field` 圆角，内边距采用 `input`，最小高度（46px）。原生复选框用深蓝强调，课时复选框为（23px），题型复选框为（20px）。保留关联标签和原生选择、键盘及禁用行为。错误信息以深红文字和浅红底承载完整句子，不只改变输入框颜色。

### Navigation

顶栏深蓝、文字浅色，桌面最小高度（96px），窄屏（78px）。当前入口同时使用白色加粗文字和暖橙底边，悬停增加浅一档深蓝背景。窄屏隐藏导航图标，保留可读文字。单元导航当前项使用深蓝实底和白字，同时显示已选数量。

### Lesson Selection

课时使用整行可点击标签、原生复选框、序号和名称。桌面最小行高（70px），窄屏（64px）；行间以浅线分隔。选中后保留复选标记，文字变深蓝并加重。底部持续显示选择计数，跨单元选择汇总以正文显示。

### Mode Selection

两项方式选择使用并排按钮，未选浅灰蓝、选中深蓝白字，以 `aria-pressed` 标明状态。桌面最小高度（74px）且图标在文字上方；中屏及以下改为横向排列、最小高度（48px）。

### Question and Answer

玩家姓名、题型、题号和细进度条置于题干之前。答案行最小高度（60px），内容左对齐；选中显示蓝底和蓝边，正确答案显示浅绿底和绿边。已答选项保持完全不透明，避免内容在提交后变淡；单人反馈另用图标、判定文字、正确答案和解析说明结果。

页面状态转换只作（160ms）淡入，透明度从（0.8）到（1），缓动为（cubic-bezier(.16, 1, .3, 1)）。`prefers-reduced-motion: reduce` 同时关闭状态动画与按钮过渡。

## Do's and Don'ts

### Do:

- **Do** 用深蓝建立导航和选中状态，用暖橙标出主要行动。
- **Do** 保持中文短句、标准表单和可读的辅助文字。
- **Do** 用姓名、位置、文字和标记补足颜色信息。
- **Do** 为触控、键盘聚焦、长文本换行和减少动态保留现有支持。
- **Do** 在开发样题界面与记录中保留明确的开发标识。

### Don't:

- **Don't** 为当前平面任务控件添加装饰性投影、渐变或位移反馈。
- **Don't** 用装饰性眉题、图标字体或字符拼成的图标代替有意义的内容与 Phosphor SVG。
- **Don't** 将已提交的答案内容变淡，或仅凭颜色说明答案与玩家身份。
- **Don't** 将当前预览的视觉完成度表述为整册内容验证完成或公开发布。
