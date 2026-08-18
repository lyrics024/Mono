# Mono

Mono 是一个本地优先的个人物品管理应用。项目主体是 PWA，可以直接用浏览器运行，也可以通过仓库内的 macOS wrapper 编译成本地 `.app` 使用。

## 技术栈

- HTML / CSS / JavaScript，无前端框架依赖
- IndexedDB：本地物品、分类和图片数据存储
- Service Worker：浏览器环境下的静态资源缓存
- Web Notifications：保修到期提醒
- WebKit WKWebView：macOS 本地应用外壳
- Objective-C：macOS wrapper 与本地备份桥接

## 功能

- 物品新增、编辑、删除
- 物品字段：名称、价格、分类、购入时间、购入渠道、备注、保修截止日期、状态、主图、辅图
- 三级分类管理，支持分类树和分类内陈列
- 主页面与分类详情页支持分类内部拖拽排序
- 物品详情支持桌面端右侧面板展示
- 图片上传支持拖动、缩放、保留比例裁切
- 搜索支持名称、分类、购入渠道、备注
- 上架 / 下架状态管理
- JSON 数据导入、导出
- macOS `.app` 内自动保存本地备份
- 浏览器/PWA 环境支持离线打开已缓存资源

## 本地运行

```bash
cd mono-pwa
python3 -m http.server 8080
```

然后打开：

```text
http://localhost:8080
```

也可以使用任意静态文件服务器运行 `mono-pwa/` 目录。

## 构建 macOS App

```bash
./scripts/build-macos-app.sh
```

构建结果：

```text
build/Mono.app
```

本地 `.app` 不需要 App Store 发布。应用数据仍然保存在本机，不会提交到仓库。

## 数据存储

- 浏览器/PWA：数据保存在当前浏览器的 IndexedDB 中。
- macOS `.app`：页面数据保存在 WebView 对应的本地存储中，同时通过 native bridge 写入自动备份。
- 手动导入/导出：设置页可以导出或导入 JSON 备份文件。

## 项目结构

```text
.
├── mono-pwa/
│   ├── index.html              # 应用入口
│   ├── manifest.json           # PWA manifest
│   ├── sw.js                   # Service Worker
│   ├── assets/                 # 图标、木纹等静态素材
│   ├── css/                    # 页面样式
│   └── js/                     # 应用逻辑
├── macos/
│   └── MonoApp/                # macOS WKWebView wrapper
├── scripts/
│   └── build-macos-app.sh      # 本地 .app 构建脚本
└── Mono_PRD.docx               # 产品需求文档
```

## 代码模块

- `js/store.js`：IndexedDB 数据层、导入导出、自动备份恢复
- `js/router.js`：页面切换、详情面板与导航栈
- `js/cabinet.js`：主橱柜、子分类、物品卡片和拖拽排序
- `js/form.js`：新增/编辑表单与图片上传
- `js/crop.js`：图片裁切、缩放和拖动
- `js/detail.js`：物品详情展示
- `js/category.js`：分类树管理
- `js/search.js`：搜索
- `js/settings.js`：设置页、主题、导入导出、统计信息
- `js/notifications.js`：保修提醒
