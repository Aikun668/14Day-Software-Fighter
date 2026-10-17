"""可重复执行的演示种子数据（J005）。

生成 5 个演示账号 + 10+ DEMO 患者 + 2-3 个候选型号（指导/知识保持 DRAFT 未发布）。
幂等：依赖唯一约束 + 冲突忽略；重复运行不产生重复数据。

用法（从项目根）：
    backend\\.venv\\Scripts\\python.exe -m seed.demo_data
"""
import sys
from pathlib import Path

# 自动把 backend 加入 sys.path，使 `import app.*` 可用（seed/ 与 backend/ 同级）
_BACKEND = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))

import bcrypt

from app.core.database import Base, SessionLocal, engine
from app.models import (
    DeviceGuide,
    DeviceModel,
    GuideStep,
    Patient,
    User,
)


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _demo_user(account: str, role: str) -> User:
    return User(
        account=account,
        password_hash=_hash("123"),
        role=role,
        status="ACTIVE",
        must_change_password=False,  # 演示账号不强制改密，简化联调
    )


def seed() -> None:
    Base.metadata.create_all(bind=engine)  # 兜底：迁移未跑时也能建表
    db = SessionLocal()
    try:
        # 1) 演示账号（幂等：按 account 查重）
        accounts = {
            "admin": _demo_user("admin", "ADMIN"),
            "clinician_a": _demo_user("clinician_a", "CLINICIAN"),
            "clinician_b": _demo_user("clinician_b", "CLINICIAN"),
            "patient_x": _demo_user("patient_x", "PATIENT"),
            "patient_y": _demo_user("patient_y", "PATIENT"),
        }
        users = {}
        for key, u in accounts.items():
            existing = db.query(User).filter(User.account == u.account).first()
            if existing:
                # 强制同步演示账号：密码重置为 123，且不强制改密
                existing.password_hash = u.password_hash
                existing.must_change_password = False
                existing.status = "ACTIVE"
                users[key] = existing
            else:
                db.add(u)
                db.flush()
                users[key] = u

        # 2) 候选型号（pMDI/DPI/SMI，指导保持 DRAFT）
        models_spec = [
            ("pMDI", "万托林", "吸入气雾剂 pMDI", "阿斯利康", "DEMO-未审核"),
            ("DPI", "信必可", "都保 DPI", "阿斯利康", "DEMO-未审核"),
            ("SMI", "思力华", "能倍乐 Respimat", "勃林格殷格翰", "DEMO-未审核"),
        ]
        model_ids = {}
        for cat, brand, name, mfr, _tag in models_spec:
            m = db.query(DeviceModel).filter(DeviceModel.model_name == name).first()
            if not m:
                m = DeviceModel(
                    category=cat, brand=brand, model_name=name, manufacturer=mfr, status="ACTIVE"
                )
                db.add(m)
                db.flush()
            model_ids[name] = m.id
            # 每型号一个 DRAFT 指导（含 1 步占位，未发布）
            g = (
                db.query(DeviceGuide)
                .filter(DeviceGuide.device_model_id == m.id, DeviceGuide.version == "1.0-demo")
                .first()
            )
            if not g:
                g = DeviceGuide(
                    device_model_id=m.id,
                    version="1.0-demo",
                    title=f"{name} 操作指导（DEMO 草稿，未审核）",
                    review_status="DRAFT",
                )
                db.add(g)
                db.flush()
                db.add(
                    GuideStep(
                        guide_id=g.id,
                        step_no=1,
                        text="（待临床审核后填写正式步骤）",
                        error_notes="本步骤为演示占位，不构成正式操作指导。",
                    )
                )

        # 3) 10+ DEMO 患者（责任医护 = clinician_a）
        patient_spec = [
            ("P-001", "林女士", "哮喘（DEMO）"),
            ("P-002", "陈先生", "慢阻肺（DEMO）"),
            ("P-003", "王女士", "哮喘（DEMO）"),
            ("P-004", "李先生", "慢阻肺（DEMO）"),
            ("P-005", "赵女士", "哮喘（DEMO）"),
            ("P-006", "周先生", "慢阻肺（DEMO）"),
            ("P-007", "吴女士", "哮喘（DEMO）"),
            ("P-008", "郑先生", "慢阻肺（DEMO）"),
            ("P-009", "孙女士", "哮喘（DEMO）"),
            ("P-010", "胡先生", "慢阻肺（DEMO）"),
            ("P-011", "何女士", "哮喘（DEMO）"),
            ("P-012", "郭先生", "慢阻肺（DEMO）"),
        ]
        for code, name, diag in patient_spec:
            p = db.query(Patient).filter(Patient.patient_code == code).first()
            if not p:
                db.add(
                    Patient(
                        patient_code=code,
                        display_name=name,
                        diagnosis_label=diag,
                        note="DEMO 演示数据，非真实患者",
                        assigned_clinician_id=users["clinician_a"].id,
                        account_user_id=None,
                    )
                )

        db.commit()
        print("种子数据完成：")
        print(f"  账号 {len(users)} 个（admin / clinician_a / clinician_b / patient_x / patient_y）")
        print(f"  患者 {len(patient_spec)} 个（DEMO）")
        print(f"  型号 {len(model_ids)} 个（指导均为 DRAFT，未审核）")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
