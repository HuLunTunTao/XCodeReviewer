## 目标概述

* 扩充文本文件发现与语言映射，覆盖 C/C++、Godot、Flutter/Dart 所需的所有后缀与关键清单文件。

* 增加项目类型启发式检测（Godot、Flutter、C/C++），在审计流程中识别并展示。

* 针对新语言与构建脚本增强审计提示词，以提高问题定位与建议质量。

* 更新即时分析上传的可选文件类型；重建 Docker 镜像使新能力可用。

## 代码改动点

* 文件扩展白名单：

  * `src/features/projects/services/repoScan.ts:7-10` 扩充 `TEXT_EXTENSIONS`

  * `src/features/projects/services/repoScan.ts:16` 保持大小写不敏感匹配

  * `src/features/projects/services/repoZipScan.ts:6-10,18-20` 同步扩充 `TEXT_EXTENSIONS` 与 `isTextFile`

* 语言映射：

  * `src/shared/utils/utils.ts:82-105` 扩充 `getLanguageFromExtension`

  * `src/features/projects/services/repoZipScan.ts:89-113` 扩充 `getLanguageFromPath`

* 语言列表：

  * `src/shared/constants/index.ts:4-17` 扩充 `SUPPORTED_LANGUAGES`（新增 `dart`、`gdscript`、`objectivec`、`objectivecpp`，必要时考虑 `cmake`、`makefile` 的显示策略）

* 即时分析上传：

  * `src/pages/InstantAnalysis.tsx:590-593` 扩充 `accept`，加入 `.gd,.dart,.m,.mm,.cxx,.hpp,.hxx,.tpp,.ipp,.inl,.cmake`

## 扩展文件发现（新增后缀与关键文件）

* C/C++ 项目：新增 `.hpp,.hxx,.tpp,.ipp,.inl,.cxx,.C,.H,.mm,.m,.cmake`；并对 `CMakeLists.txt`、`Makefile` 做无后缀匹配。

  * 在 `repoScan.ts`与`repoZipScan.ts` 的文本过滤阶段加入：

    * 扩展匹配：`endsWith(ext)` 前统一 `toLowerCase()`，大小写扩展 `.C/.H` 通过双写入或名称统一。

    * 无后缀匹配：对 `basename` 等于 `CMakeLists.txt`、`Makefile` 的文件额外保留。

* Godot 项目：新增 `.gd,.gdnlib,.gdns,.tscn,.tres,.scn,.res`；关键文件 `project.godot`、`export_presets.cfg`。

* Flutter/Dart 项目：新增 `.dart` 与构建相关 `pubspec.yaml`、`analysis_options.yaml`、`*.gradle`、`*.xml`、`*.plist`；保留已有 `.kt,.java,.swift`。

## 语言映射与提示词增强

* 语言映射（统一返回用于提示词的 `language` 值）：

  * C/C++：`c, cpp, cc, cxx, h, hh, hpp, hxx, tpp, ipp, inl → cpp`；`c → c`（可选：若细分，`.h` 根据同目录 `.c`/`.cpp` 占比选择）

  * Objective‑C/Objective‑C++：`.m → objectivec`，`.mm → objectivecpp`

  * Godot：`.gd → gdscript`；场景/资源/库文件（`.tscn,.tres,.scn,.res,.gdnlib,.gdns`）→ `godot-config`

  * 构建脚本：`CMakeLists.txt/.cmake → cmake`，`Makefile → makefile`，`*.gradle → gradle`，`*.xml → xml`，`*.plist → plist`，`pubspec.yaml → pubspec`，`analysis_options.yaml → dart-config`

* 审计提示词：在 `CodeAnalysisEngine.analyzeCode` 内增加轻量语言特定提示插入：

  * C/C++/Objective‑C：内存安全、未定义行为、头/模板惯例、ARC/retain/release（Obj‑C）

  * Godot/GDScript：信号连接、节点路径、`tscn/tres` 配置一致性、资源加载与生命周期

  * Flutter/Dart：`pubspec.yaml` 依赖约束、`analysis_options.yaml` 规则、平台（Android Gradle/Manifest XML、iOS Info.plist）常见问题

  * 构建脚本：`cmake`/`makefile` 变量作用域、目标依赖、跨平台选项

## 项目类型启发式检测

* 在仓库扫描阶段统计文件迹象并得出 `projectType`：

  * C/C++：存在 `CMakeLists.txt` 或大量 `c/cpp` 家族文件

  * Godot：根目录存在 `project.godot` 或 `.gd/.tscn` 文件占比明显

  * Flutter：根目录存在 `pubspec.yaml` 且含 `flutter` 依赖，或同时存在 `android/build.gradle` 与 `ios/Runner/Info.plist`

* 集成位置：`src/features/projects/services/repoScan.ts` 获取文件树后，计算并将 `projectType` 放入任务日志或页面状态（不强制落库，保持与现有 schema 兼容）。

## 即时分析与上传体验

* `InstantAnalysis` 文件选择支持 `.gd`、`.dart`、Obj‑C/Obj‑C++ 与 C++ 扩展，用户可直接上传进行审计。

* `supportedLanguages` 来自 `SUPPORTED_LANGUAGES`；新增语言将出现在下拉中，可手动选择覆盖自动映射。

## 无后缀文件处理

* 在过滤函数中加入文件名直接匹配：`CMakeLists.txt`、`Makefile`、`project.godot`、`export_presets.cfg`、`pubspec.yaml`、`analysis_options.yaml`。

* 对这些文件映射到专用语言键以优化提示词（如 `cmake`、`makefile`、`godot-config`、`pubspec`、`dart-config`）。

## Flutter 插件平台代码

* 扫描保留 Android 端：`*.gradle`、`AndroidManifest.xml`、`res/*.xml`、`src/**/*.kt|java`；iOS 端：`*.plist`、`*.m|mm|swift`。

* 检测到标准插件目录结构时在项目类型提示中标注 `flutter-plugin`。

## Docker 更新

* 现有镜像为前端静态站（Nginx）；新增能力为前端与审计逻辑调整，无需系统级工具安装。

* 仍使用现有 `Dockerfile`/`docker-compose.yml`；重建镜像使新代码生效：

  * `docker compose build && docker compose up -d`

  * 或使用 CI 工作流自动构建与推送（`.github/workflows/release.yml` 保持不变）。

## 验证方案

* 仓库扫描：使用含 `CMakeLists.txt`、`Makefile` 的 C/C++ 仓库；含 `project.godot` 的 Godot 仓库；标准 Flutter 应用与插件仓库。

* ZIP 扫描：打包上述示例为 ZIP，验证 `repoZipScan` 路径与语言映射一致。

* 即时分析：上传 `.gd`、`.dart`、`.m/.mm`、`CMakeLists.txt` 单文件，检查输出问题清单与语言标签。

* UI：下拉语言出现 `dart`/`gdscript`/`objectivec`/`objectivecpp`；项目类型提示正确显示。

## 兼容性与注意事项

* `.h` 的 C/C++ 二义性：默认归入 `cpp`；如需更精准可按同目录 `.c/.cpp` 占比细分。

* 扩展白名单增多会增加文件数；保持 `MAX_ANALYZE_FILES` 与并发/间隔参数以防 LLM 限流。

* 关键清单文件可能很大；仍受 `MAX_FILE_SIZE_BYTES` 限制，必要时对 `pubspec.yaml`/`CMakeLists.txt` 适当放宽。

* 无需新增后端依赖；所有审计仍通过 LLM 适配提示词完成。

