"""Behavioral regression on isolated fixtures; never writes real clinical records."""
from capture import *

def select(page, label, value):
    page.get_by_label(label,exact=True).click()
    page.locator('.ant-select-dropdown:visible').get_by_text(value,exact=True).click()

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=CHROME,headless=True)
    context=browser.new_context(viewport={'width':1440,'height':900})
    context.add_init_script("sessionStorage.setItem('medix-demo-assets','approved-fixture-v1')")
    fixture=Fixture();context.route('**/api/**',fixture.route)
    page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    login(page);go(page,'/patients')
    (OUT/'interaction-dom.txt').write_text(page.locator('body').aria_snapshot(),encoding='utf-8')
    results={}

    # Server combination filters; count and actual request parameters agree.
    select(page,'按诊断标签筛选','支气管哮喘');page.keyboard.press('Escape')
    select(page,'按账号绑定状态筛选','已绑定')
    expect(page.locator('.ml-table tbody tr')).to_have_count(1)
    assert page.locator('.ml-table tbody tr').inner_text().startswith('林女士')
    assert any(path=='/api/patients' and q.get('account_status')==['bound'] and q.get('diagnosis_label')==['支气管哮喘（DEMO）'] for _,path,q in fixture.requests)
    page.get_by_role('button',name='清除筛选').click();expect(page.locator('.ml-table tbody tr')).to_have_count(10)
    results['combined_server_filters']=True

    # Distinct model and guide IDs; switching models clears the old guide.
    page.get_by_role('button',name='为李先生现场评估',exact=True).click()
    select(page,'型号','吸入气雾剂 pMDI');select(page,'指导版本','标准操作指导')
    select(page,'型号','无指导型号');expect(page.get_by_role('dialog').get_by_role('button',name='确定')).to_be_disabled()
    assert '标准操作指导' not in page.get_by_role('dialog').inner_text()
    select(page,'型号','吸入气雾剂 pMDI');select(page,'指导版本','标准操作指导')
    page.get_by_label('评估结论',exact=True).fill('操作熟练')
    page.get_by_role('dialog').get_by_role('button',name='确定').click();expect(page.get_by_role('dialog')).to_have_count(0)
    payload=next(data for path,data in fixture.posts if path=='/api/training-sessions')
    assert payload['device_model_id']=='model-A' and payload['guide_id']=='guide-C' and payload['patient_id']==PATIENTS[0]['id']
    results['evaluation_model_guide_and_stale_clear']=True

    # More than one server page, long/same names, and creation while on page two.
    fixture.patients += [{**PATIENTS[i%10],'id':f'extra-{i}','display_name':'欧阳明月长名字用于换行测试' if i==0 else ('李先生' if i==1 else f'演示患者{i}')} for i in range(15)]
    go(page,'/workbench');go(page,'/patients');expect(page.locator('.ml-table tbody tr')).to_have_count(20)
    shot(page,'03-twenty-rows.png',True)
    page.get_by_role('button',name='下一页').click();expect(page.locator('.ml-pager')).to_contain_text('2 / 2');expect(page.locator('.ml-table tbody tr')).to_have_count(5)
    page.get_by_role('button',name='新建患者',exact=True).click()
    page.get_by_label('患者编号',exact=True).fill('TEST-NEW');page.get_by_label('姓名/别名',exact=True).fill('新建演示患者')
    page.get_by_role('dialog').get_by_role('button',name='确定').click();expect(page.get_by_role('dialog')).to_have_count(0)
    expect(page.locator('.ml-pager')).to_contain_text('1 / 2');expect(page.locator('.ml-table tbody tr')).to_have_count(20)
    assert '新建演示患者' in page.locator('.ml-table tbody tr').first.inner_text()
    results['pagination_and_create_reset_page']=True
    fixture.fail_patients=True
    page.get_by_role('textbox',name='搜索姓名或编号',exact=True).fill('触发失败');page.get_by_role('textbox',name='搜索姓名或编号',exact=True).press('Enter')
    expect(page.get_by_role('alert').filter(has_text='患者服务暂不可用')).to_be_visible();shot(page,'03-service-error.png')
    fixture.fail_patients=False;page.get_by_role('button',name='清除筛选').click()
    results['patient_error_visible']=True

    # A follow-up closes exactly the selected task and refreshes its parent list.
    go(page,'/workbench');page.get_by_role('button',name='处理任务',exact=True).first.click()
    page.get_by_role('button',name='确认处理',exact=True).click();expect(page.get_by_text('处理失败',exact=True)).to_be_visible()
    page.locator('.ant-modal:visible textarea').fill('已联系患者核实登记情况')
    page.get_by_role('button',name='确认处理',exact=True).click();expect(page.get_by_role('dialog')).to_have_count(0)
    expect(page.locator('.ml-task-table tbody tr')).to_have_count(6)
    payload=next(data for path,data in fixture.posts if path=='/api/followups')
    assert payload['task_id']=='task-0' and payload['close_task'] is True
    results['close_task_atomic_followup_and_refresh']=True

    # Each successful login retains existing role routing priority.
    for role,change,target in [('ADMIN',False,'/admin'),('CLINICIAN',True,'/change-password')]:
        fixture.role=role;fixture.change_password=change
        page.goto(BASE+'/login');page.get_by_label('账号',exact=True).fill('fixture');page.get_by_label('密码',exact=True).fill('fixture-only')
        page.get_by_role('button',name='登录',exact=True).click();page.wait_for_url('**'+target)
    results['admin_and_first_password_routes']=True
    results['uncaught_js_errors']=errors
    (OUT/'interaction-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(results,ensure_ascii=False,indent=2));browser.close()
