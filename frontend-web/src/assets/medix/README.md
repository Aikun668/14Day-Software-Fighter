# Medix Light 本地栅格资产

生成日期：2026-11-09。生成工具：内置 `image_gen`，未调用 API/CLI。仅补齐 00–03 视觉资产，冻结目标图未改动。

|文件|实际尺寸|用途|SHA-256|
|---|---|---|---|
|doctor-assistant.png|1585×992，RGBA，alpha 0–255|登录页与侧栏底部装饰；保持比例，不作头像|90962DE35F6330F5197221BE696AD0DD4A863356BD4973005C3D211A1594275C|
|demo-portraits.png|1448×1086，RGB，4列×3行，每格362×362|显式演示模式中的虚构患者头像及演示医护头像|767FED20D2AE0C4C5E766DF19E1434023F052E9DCC264F621408351E4CE683A5|
|brand-symbol.png|1254×1254，RGBA，alpha 0–255|品牌图形，无文字|8AEB6103D8FDFA2EA1EE4CC7FC73868B2E13D1B02226CE55AE149FA7C6AEEAE6|

## 使用约束

- 头像是生成的虚构人物。仅映射到明确的演示 fixture ID，不随机给真实患者分配人脸。生产头像须来自真实授权来源；无头像时走中性占位。
- 头像图集无边距、无沟槽，按 4×3 等分定位，背景尺寸为 400% 300%。列百分比为 0、33.333333、66.666667、100；行百分比为 0、50、100。实际图集尺寸与提示词要求不同，但每个单元精确为正方形。
- 插画为透明 PNG；用 contain 显示，不加不透明背景、不拉伸。首轮过于写实的医生图已弃用，未进入项目。
- 不应复制整页设计图作为产品界面；这两个文件只是独立可复用素材。

## 头像位置（从左到右、从上到下，索引 0 起）

|索引|预定演示对象|人物|
|---|---|---|
|0|李先生|40岁黑短发男性|
|1|周先生|65岁银发男性|
|2|陈先生|50岁戴眼镜男性|
|3|吴女士|45岁短卷发女性|
|4|孙女士|35岁短发女性|
|5|林女士|55岁女性|
|6|赵女士|40岁卷发女性|
|7|郑先生|28岁男性|
|8|王女士|45岁女性|
|9|杨先生|65岁银发男性|
|10|备用演示人物|60岁女性|
|11|演示医护|35岁白大褂男性|

## 最终提示词

### 医生插画（第二轮，采用）

Edit image 1 into a STYLIZED 3D CARTOON mascot, following ONLY the little doctor illustration at the bottom-left corner of image 2 as the style/composition reference. Do NOT reproduce the dashboard, cards, text, or any UI from image 2. Output only an isolated compact doctor-and-laptop-and-plant transparent asset. The current image 1 is much too photorealistic: replace the realistic anatomy/textures with the rounded cute proportions, enlarged head, simplified soft clay/plastic modeling, smooth sculpted black hair and smiling cartoon face from the little doctor in image 2. Keep black round glasses, white coat, stethoscope, pale lavender laptop, muted sage broad-leaf plant at left. Show both hands at keyboard height. Composition a small wide 3D cartoon, approximate visible-art aspect ratio 1.6:1, generous clear 6 percent margins so head, leaves, hands and full laptop are intact. The entire group should be a polished playful UI illustration readable at 160 by 108 px. Soft bright lighting, no realistic skin detail, no realistic fabric detail. No black background, no glow or shadow halo, no white rectangular backdrop. Make actual transparent alpha around all the objects with crisp clean antialiasing. No floor/table/base/pedestal, no extra icons, no texts, no letters, no logo on laptop, no frame. Strongly match the little 3D CARTOON doctor from image 2, not the photographic rendering of image 1.

图1：已弃首轮插画；图2：`docs/design/medix-light/approved-batch-01/03-patients.png`，仅作风格参考。

### 演示头像图集

Use case: photorealistic-natural. Asset type: a SINGLE raster sprite atlas for a healthcare dashboard's explicitly fictional demo patient avatars. Make one image 1536 pixels wide by 1152 pixels tall, exactly 4 columns by 3 rows, TWELVE perfectly square identical tiles, each 384 by 384 px, no gutters, no margin, no padding, no borders, no labels, no text anywhere. Every tile is a separate polished photorealistic studio HEAD AND SHOULDERS portrait of a different fictional East Asian adult. All have a friendly natural slight smile, everyday appropriate shirts/blouses, no illness, and soft bright diffuse light with natural real skin detail. Center every face at the same position and same scale: eyes around 43 percent of tile height, full hair and head intact, shoulders only across bottom, approximately 8 percent top headroom. Absolutely no overlap between adjacent tiles. Soft neutral pastel backgrounds alternate pale taupe, blush, warm gray, sage and off-white, one plain flat backdrop per tile. Top row left to right: (1) 40-year-old Chinese man, short black hair, blue shirt, no glasses; (2) 65-year-old Chinese man, silver short hair, gentle smile, light shirt, no glasses; (3) 50-year-old Chinese man, neat black hair with gray temples, thin-frame glasses; (4) 45-year-old Chinese woman, short softly curly dark hair, light blouse. Middle row left to right: (5) 35-year-old Chinese woman, neat chin-length short black hair; (6) 55-year-old Chinese woman, elegant short dark hair and warm smile; (7) 40-year-old Chinese woman, dark shoulder-length wavy hair; (8) 28-year-old Chinese man, short black hair, clean-shaven. Bottom row left to right: (9) 45-year-old Chinese woman, short soft wavy black hair, light blouse; (10) 65-year-old Chinese man, silver hair, friendly smile, pale collared shirt; (11) 60-year-old Chinese woman, short gray-black hair; (12) 35-year-old Chinese male doctor with short black hair, a white doctor's coat and blue shirt, no stethoscope needed. Real photography, distinct individual faces, consistent camera angle, consistent portrait crop, no cartoon or illustration, no watermarks. All twelve tiles must be visibly and precisely aligned edge to edge as a 4x3 rectangular atlas.

## 素材检查

- 两个最终文件均已用 `view_image` 打开核查，未修改冻结图。
- 插画：3D 卡通风格、医生/笔记本/植物完整、无文字、无白色矩形背景。边缘有少量生成器抗锯齿杂色，实际 160×108 槽位需由页面截图再次核查。
- 头像：12 张写实头肩像、等距 4×3、无边框和文字，脸部主体完整。不是目标图中原人物的精确身份复刻，属于同风格虚构资产。

## 品牌符号补充

`brand-symbol.png`：内置 image_gen 按冻结目标图左上角的四向圆润医疗/呼吸符号生成，仅图形、不包含 Medix 文字。用于约32px的品牌标记。生成器输出的填充有轻微色值变化；若须精确使用 `#8146FF`，可将本透明PNG作为 CSS mask-image，背景使用该品牌 token，不能手工重画近似符号。

最终提示词：

Create an isolated production UI brand-symbol asset from the abstract purple mark at the TOP-LEFT of the supplied dashboard reference, keeping the rounded four-direction medical/breathing cross idea. Output only the symbol, never any dashboard UI or any text. A compact centered abstract four-lobed healthcare cross: four softly rounded outward arms, curved concave inner corners and clean narrow white/transparent negative-space channels around the center, balanced with slight rotational energy. The reference mark is the visual guide. Single solid purple #8146FF fill with fully transparent negative spaces and transparent outside. Flat vector-like crisp silhouette, thick enough to remain readable at 32px CSS size. Square 1024x1024 canvas, symbol fills about 90% of canvas with equal margins. No letters, no Medix wordmark, no slogan, no plus in a box, no enclosing box or circle, no shadows, no texture, no blur, no bevel, no gradients, no 3D. Clean antialiasing and true alpha transparency. Only the isolated purple mark.

## 2026-11-09 字体落地

为保证实际呈现，页面从本地 WOFF2 加载 Noto Sans SC Regular/Medium。源自本机已安装的 Noto Sans SC 字体（Windows/Fonts 下同名字体文件），通过 fontTools 无字形更改转为 WOFF2；字体许可证和来源名称保留在文件metadata，另附 fonts/OFL.txt。上游：https://github.com/notofonts/noto-cjk 。

- `*-core.woff2`：GB2312常用字、拉丁字母和标点子集；两档合计约2.8MiB，首屏只下载这两档。
- 不带core的文件：完整字库；罕用姓名字符缺字时由 `Medix Sans Extended` 加载。
- 不依赖外网字体CDN，不影响旧页面的字体作用域。
- 浏览器实测actual platform font为NotoSansSC-Regular/Medium、isCustomFont=true，见验收font-checks.json。

演示头像除显式截图会话外，也支持后端记录保留明确DEMO诊断标记的种子患者；去掉DEMO标记且无avatar_url的真实记录只显示中性人物图标。
