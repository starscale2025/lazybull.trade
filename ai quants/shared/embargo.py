"""Embargo + purging for time-series CV (de Prado, "Advances in Financial ML" ch 7).

Issue: a sample at time t with horizon h has a label that depends on prices through
t+h. If validation starts at time T_val, then training samples in [T_val-h, T_val]
have labels that LEAK into the validation period. Naive train/val split is biased
upward by 1-3 percentage points.

Fix: PURGE training samples within `embargo_days` of the val boundary.
"""
from __future__ import annotations
import numpy as np
import pandas as pd


def embargo_split(dates: pd.DatetimeIndex, val_frac: float = 0.2, embargo_days: int = 20):
    """Returns (train_mask, val_mask) with `embargo_days` purged before val_start."""
    sorted_d = np.sort(dates.values)
    cutoff = pd.Timestamp(sorted_d[int((1 - val_frac) * len(sorted_d))])
    embargo_start = cutoff - pd.Timedelta(days=int(embargo_days * 1.6))  # ~20 trading days
    train = dates < embargo_start
    val = dates >= cutoff
    return train, val, cutoff
