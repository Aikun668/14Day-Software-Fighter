"""覆盖矩阵（患者 × 日期）的纯计算（03 A-1）。不访问数据库。

调用方（api/stats.py）负责：只传入负责患者、窗口内已到期且有效的时点（分母 S），
以及这些时点上有效的登记所覆盖的 slot_id 集合。这里只做分组与比率计算。
口径与 overview / trend 保持一致：coverage_rate = ROUND(M/N*100, 1)，N=0 时为 null。
"""
from collections import defaultdict
from datetime import date
from typing import Iterable, Sequence
from zoneinfo import ZoneInfo

from app.schemas.stats import MatrixCell, MatrixResponse, MatrixRow

CellCounts = dict[tuple[str, date], int]


def coverage_rate(m: int, n: int) -> float | None:
    """覆盖率；无计划（n=0）返回 None，绝不返回 0%。"""
    return round(m / n * 100, 1) if n > 0 else None


def _bucket_slots(slots: Iterable, covered_slot_ids: set, tz_name: str) -> tuple[CellCounts, CellCounts]:
    """按（患者 id 字符串, 业务时区日期）分桶，返回 (N 计数, M 计数)。"""
    tz = ZoneInfo(tz_name)
    n_by_cell: CellCounts = defaultdict(int)
    m_by_cell: CellCounts = defaultdict(int)
    for slot in slots:
        key = (str(slot.patient_id), slot.scheduled_at.astimezone(tz).date())
        n_by_cell[key] += 1
        if slot.id in covered_slot_ids:
            m_by_cell[key] += 1
    return n_by_cell, m_by_cell


def _build_row(patient, days: Sequence[date], n_by_cell: CellCounts, m_by_cell: CellCounts) -> MatrixRow:
    """单个患者的一行：逐日出格，并汇总行合计。"""
    pid = str(patient.id)
    cells: list[MatrixCell] = []
    for day in days:
        n = n_by_cell.get((pid, day), 0)
        m = m_by_cell.get((pid, day), 0)
        cells.append(MatrixCell(
            day=day.isoformat(), N=n, M=m, missing=n - m, coverage_rate=coverage_rate(m, n),
        ))
    row_n = sum(c.N for c in cells)
    row_m = sum(c.M for c in cells)
    return MatrixRow(
        patient_id=pid,
        patient_code=patient.patient_code,
        display_name=patient.display_name or patient.patient_code,
        N=row_n,
        M=row_m,
        coverage_rate=coverage_rate(row_m, row_n),
        cells=cells,
    )


def build_coverage_matrix(
    *,
    from_str: str,
    to_str: str,
    patients: Sequence,
    slots: Iterable,
    covered_slot_ids: set,
    days: Sequence[date],
    tz_name: str,
) -> MatrixResponse:
    """把已到期时点按（患者, 业务时区日期）分桶，生成矩阵。

    patients 元素需有 id / patient_code / display_name；
    slots 元素需有 id / patient_id / scheduled_at。
    """
    n_by_cell, m_by_cell = _bucket_slots(slots, covered_slot_ids, tz_name)
    rows = [_build_row(p, days, n_by_cell, m_by_cell) for p in patients]

    # 与 overview 相同的紧急排序：缺失多在前；无计划（N=0）垫底；同缺失数按编号正序
    rows.sort(key=lambda r: (r.N == 0, -(r.N - r.M), r.patient_code))

    total_n = sum(r.N for r in rows)
    total_m = sum(r.M for r in rows)
    return MatrixResponse(
        from_=from_str,
        to=to_str,
        timezone=tz_name,
        days=[d.isoformat() for d in days],
        total_N=total_n,
        total_M=total_m,
        coverage_rate=coverage_rate(total_m, total_n),
        rows=rows,
    )
