"""一键验收脚本：重置演示数据 → 依次执行各阶段测试 → 输出汇总。

用法（项目根目录）：
    backend\\.venv\\Scripts\\python.exe -m tests.run_acceptance

说明：
- 先执行 seed.reset_demo + seed.demo_data_full，保证测试起点为「干净且口径正确」的演示库；
- 再按 S2→S6 顺序执行各 smoke 脚本（部分脚本非幂等，必须依赖干净起点）；
- 输出 PASS/FAIL 统计，便于交付时复现。
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent   # backend/tests/x.py → 项目根
BACKEND = ROOT / "backend"
PY = BACKEND / ".venv" / "Scripts" / "python.exe"
TESTS = BACKEND / "tests"

# Windows 默认控制台是 GBK：脚本里的中文与 ▶ 会直接抛 UnicodeEncodeError，
# 导致「一键验收」在第一条输出就崩掉，与测试本身无关。
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # 已重定向或不支持 reconfigure
        pass

# 执行顺序：会写入数据的脚本各自前置「重置+生成」，保证彼此不被污染。
# reset=True 表示该步骤前先重置演示数据。
RESET = [str(PY), "-m", "seed.reset_demo"]
SEED = [str(PY), "-m", "seed.demo_data_full"]

STEPS = [
    # 只读校验类：放在最前，依赖干净且口径正确的库
    ("AI 边界样本", [str(PY), str(TESTS / "smoke_ai_samples.py")], True),
    ("S6 全量回归", [str(PY), str(TESTS / "smoke_s6_regression.py")], True),
    # 写入类：每个脚本前重置，避免固定编号冲突与统计污染
    ("S2 认证与基础", [str(PY), str(TESTS / "smoke_s2.py")], True),
    ("S3 指导与训练", [str(PY), str(TESTS / "smoke_s3.py")], True),
    ("S4 计划与登记", [str(PY), str(TESTS / "smoke_s4.py")], True),
    ("S4 版本/PRN/撤销", [str(PY), str(TESTS / "smoke_s4b.py")], True),
    ("S5 任务随访 AI", [str(PY), str(TESTS / "smoke_s5.py")], True),
    ("S6 越权隔离", [str(PY), str(TESTS / "smoke_s6_security.py")], True),
    ("S6 AI 故障回退", [str(PY), str(TESTS / "smoke_s6_ai.py")], True),
    ("医护闭环（增补）", [str(PY), str(TESTS / "smoke_clinic_loop.py")], True),
    ("知识闭环（增补）", [str(PY), str(TESTS / "smoke_kb_loop.py")], True),
]


def _run(cmd: list[str], cwd: str) -> tuple[str, int]:
    """执行命令并把输出重定向到文件读取（沙箱不允许管道捕获子进程输出）。

    返回 (输出, 退出码)；退出码非 0 说明该步骤自身失败（如重置脚本外键违约）。
    """
    tmp = TESTS / "_step_out.txt"
    code = 1
    with tmp.open("w", encoding="utf-8") as fh:
        try:
            code = subprocess.run(cmd, cwd=cwd, stdout=fh, stderr=subprocess.STDOUT,
                                  timeout=300, check=False).returncode
        except Exception as e:  # noqa: BLE001
            fh.write(f"执行异常：{e}")
    out = tmp.read_text(encoding="utf-8", errors="replace")
    tmp.unlink(missing_ok=True)
    return out, code


def main() -> int:
    total_pass = total_fail = 0
    lines: list[str] = []
    fatal = False

    for name, cmd, need_reset in STEPS:
        print(f"\n{'=' * 60}\n▶ {name}\n{'=' * 60}")

        # 需要干净起点的步骤：先重置并重建演示数据
        if need_reset:
            reset_out, reset_code = _run(RESET, str(ROOT))
            if reset_code != 0:
                # 重置失败必须终止：否则后续步骤跑在脏库上，结果不可信
                print(reset_out)
                print(f"[致命] 演示数据重置失败（退出码 {reset_code}），终止验收。")
                lines.append(f"{'演示数据重置':20} 退出码={reset_code}（致命）")
                fatal = True
                break
            seed_out, seed_code = _run(SEED, str(ROOT))
            if seed_code != 0:
                print(seed_out)
                print(f"[致命] 演示数据生成失败（退出码 {seed_code}），终止验收。")
                lines.append(f"{'演示数据生成':20} 退出码={seed_code}（致命）")
                fatal = True
                break
            m = re.search(r"medication_plans\s+(\d+)", seed_out)
            if m:
                print(f"[数据已重置] medication_plans={m.group(1)}")

        out, step_code = _run(cmd, str(ROOT))
        print(out)

        # 只统计以 PASS/FAIL 开头的断言行，避免把「回归结果：16 PASS, 0 FAIL」这类汇总行计入
        p = len(re.findall(r"^\s*PASS\b", out, re.MULTILINE))
        f = len(re.findall(r"^\s*FAIL\b", out, re.MULTILINE))
        total_pass += p
        total_fail += f
        lines.append(f"{name:20} PASS={p:3}  FAIL={f:3}")
        if step_code != 0 and f == 0:
            # 没有任何 FAIL 行却非 0 退出：通常是脚本异常/连接失败，不能当通过
            print(f"[警告] {name} 退出码 {step_code}，但未输出 FAIL 断言，按失败计。")
            total_fail += 1

    print(f"\n{'=' * 60}\n汇总\n{'=' * 60}")
    for line in lines:
        print(line)
    print(f"\n合计：PASS={total_pass}  FAIL={total_fail}")
    if fatal:
        return 1
    return 0 if total_fail == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
