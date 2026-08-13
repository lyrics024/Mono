# Mono — 个人物品管理系统 (PWA)

以「橱柜」为核心隐喻的个人物品管理 PWA 应用。Kami 风格的暖色调 + 墨蓝单色设计。

## 技术栈

- 纯 HTML/CSS/JavaScript，零依赖
- IndexedDB 本地存储
- Service Worker 离线缓存
- PWA 可安装到主屏幕

## 快速启动

```bash
# 方式 1：Python HTTP 服务器
cd mono-pwa
python3 -m http.server 8080

# 方式 2：任意静态文件服务器
npx serve mono-pwa
```

然后在浏览器打开 `http://localhost:8080`

iPhone 上：Safari 打开地址后，点「分享 → 添加到主屏幕」即可作为独立 App 使用。

## 项目结构

```
mono-pwa/
├── index.html                   # 应用入口 + 全部页面模板
├── manifest.json                # PWA manifest
├── sw.js                        # Service Worker（离线缓存）
├── css/
│   ├── variables.css            # 设计 Token（Kami 调色板）
│   ├── base.css                 # 基础重置 + 布局 + 通用组件
│   ├── animation.css            # 橱柜开门 3D 动画
│   ├── cabinet.css              # 橱柜陈列视图
│   ├── item.css                 # 物品详情页
│   ├── forms.css                # 新增/编辑表单
│   ├── search.css               # 搜索 + 分类管理样式
│   └── settings.css             # 设置页
├── js/
│   ├── store.js                 # IndexedDB 数据层（CRUD + 计算字段）
│   ├── utils.js                 # Toast、Modal、格式化工具
│   ├── router.js                # 页面导航 + 路由栈
│   ├── animation.js             # 冷启动橱柜开门动画
│   ├── cabinet.js               # 橱柜主页 + 子橱柜渲染
│   ├── detail.js                # 物品详情页
│   ├── form.js                  # 新增/编辑物品表单
│   ├── category.js              # 分类管理（树状结构）
│   ├── search.js                # 搜索功能
│   ├── settings.js              # 数据导入/导出 + 统计
│   ├── notifications.js         # 保修到期 Web 通知
│   └── app.js                   # 主入口 + 事件绑定
└── assets/
    └── icons/                   # PWA 应用图标
```

## 功能覆盖（对照 PRD）

| PRD 需求 | 状态 | 实现方式 |
|---------|------|---------|
| 5.1 橱柜开门动画 | ✅ | CSS 3D transform (rotateY) |
| 5.2 分类体系（3 层嵌套） | ✅ | 递归树 + depth 约束 |
| 5.3 物品字段定义 | ✅ | 全部 11 个字段 |
| 5.4 图片规则 | ✅ | 1 主图 + 2 辅图，Base64 存储 |
| 5.5 上架/下架 | ✅ | Segmented Control + 状态 badge |
| 5.6 删除确认 | ✅ | 二次确认 Modal |
| 5.7 橱柜陈列主页 | ✅ | 搁板隐喻 + 水平滑动 |
| 5.8 搜索 | ✅ | name/category/channel 三字段 |
| 5.9 数据同步 | ⚠️ | 暂用 JSON 导入导出 |
| 5.10 导入导出 | ✅ | JSON 文件下载/上传 |
| 5.11 保修提醒 | ✅ | Web Notifications API |
| 5.12 输入校验 | ✅ | 前端校验 + 错误提示 |
| 5.13 分类删除级联 | ✅ | 物品自动移入「未归类」 |
| 5.14 空状态处理 | ✅ | 引导文案 + 添加按钮 |
| 5.15 批量删除 | ⚠️ | 单件删除已实现，批量待加 |
| 5.16 权限与异常处理 | ✅ | 格式校验 + toast 提示 |
| 1:1 图片裁切 | ❌ | 待后续版本（需 canvas 结合） |

## 设计参考

Kami by tw93 — 暖羊皮纸 `#f5f4ed`、墨蓝 `#1B365D`、衬线字体、无硬阴影