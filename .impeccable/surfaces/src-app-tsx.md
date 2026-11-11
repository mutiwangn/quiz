---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/styles.css"]
---

# Quiz home

Mode: Operate. Primary target: src/App.tsx. Build path: code.

## Direction contract

THESIS: 课时路线。让教师看清范围、完成准备，让两位学生各自作答。选课是主任务。

OWN-WORLD: 深蓝 #1c3155 导航、白色选课区域、冷白 #f4f7fb 页面、暖橙 #f4b545 主按钮。中文系统无衬线，适合触控的标准控件。双方用蓝与橙、固定左右位置共同区分。

STORY: 先选教材单元与任意课时，再选择单人或双人和本局设置。题目准备成功后进入对局，结算展示答题数、答对数与正确率，记录留在本机。

FIRST VIEWPORT: 96px 深蓝顶栏放 Quiz、科学答题与成绩入口。桌面三栏：左侧约 230px 单元导航，中间白底课时复选清单，右侧约 300px 准备区。标题位于清单上方，橙色开始按钮在右栏底部。平板压缩间距，窄屏改为顺序排列。签名交互为跨单元选择持续保留；双人左右两侧独立进度。状态切换用短淡入，减少动态时关闭。

FORM: 用户从方向方案中选择课时路线（catalog challenger: wayfinding-cartography-signage-midnight-transit-diagram）；本轮实际采用该方案。seed:1bfcca06a332032b。构图依据 .impeccable/mocks/decision/transit.html，内容替换为已确认的真实 2024 目录。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
