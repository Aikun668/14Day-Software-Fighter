# 11 装置型号

目标：[11](references/11-admin-devices.png)。入口/admin?tab=model。实现DeviceModelsPanel（从AdminPage抽取），API依据backend/app/api/device_models.py、schemas/device.py。

## 构图

标题“装置型号”，右上紫色“新建型号”。单张白表：类别 / 品牌 / 型号 / 厂商。列宽建议15/22/38/25%，标题不重复，行至少3.5rem。类别pMDI/DPI/SMI是领域文字，改中性浅灰标签，不用装饰紫块。型号正常字重500，厂商换行可读，空值—。无行操作列：当前没有编辑/删除型号接口，不画假按钮。

参考图某厂商有生成乱码；生产以API manufacturer为准，禁止按图猜厂商。表格状态字段保留在数据模型；如确有非ACTIVE记录，在型号旁显示真实简短状态，不默认为可用。默认图的ACTIVE不逐行重复标。

## 数据与新建

GET /api/admin/device-models?page=1&page_size=20，支持search（型号或品牌）；如果增加搜索仅做一个简洁输入，不同时放无依据的多个筛选器。服务器分页total准确，切搜索重置page并丢弃旧响应。

新建弹窗宽32rem：类别（必选pMDI/DPI/SMI）、品牌（必填）、型号名称（必填）、厂商（可空）。POST /api/admin/device-models发送category/brand/model_name/manufacturer。trim非空校验，空厂商null；保持输入的正常中文及型号大小写，不改写成缩写。后端创建status ACTIVE。

无上传装置照片、无库存/价格/患者数等新增功能。表单成功关闭清空并刷新列表/型号目录缓存；失败保留，重复点击锁。新增项排序由后端created_at升序决定，不保证出现在当前第一页；成功后可用返回项定位或提示“已创建”，不另造客户端永久置顶排序。

## 状态与验收

无数据只写“暂无型号”；加载失败重试，不能允许依赖失败目录的新建指导选择错误型号。长品牌、长型号、小屏局部滚动不溢出；第101条目录在指导/知识下拉可用；非ADMIN请求403，删除/编辑假动作不存在；重复点击仅一次POST，失败输入保留。型号新建后只在真实审计API返回事件时出现在15，不前端补日志。
