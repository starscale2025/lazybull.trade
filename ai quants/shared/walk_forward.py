"""Walk-forward cross-validation: 5 expanding-window folds.

Fold 0: train through year T-4, validate year T-4..T-3
Fold 1: train through year T-3, validate year T-3..T-2
...
Fold 4: train through year T, validate year T..now

Reports a distribution of accuracies, not a single number.
"""
from __future__ import annotations
import numpy as np
import pandas as pd


def walk_forward_splits(dates: pd.DatetimeIndex, n_folds: int = 5,
                        train_min_years: float = 4.0):
    """Yields (train_mask, val_mask) tuples for each fold."""
    sorted_dates = pd.DatetimeIndex(np.sort(np.unique(dates.values)))
    if len(sorted_dates) == 0:
        return
    end = sorted_dates[-1]
    start = sorted_dates[0]
    total_years = (end - start).days / 365.25
    val_years_per_fold = max((total_years - train_min_years) / n_folds, 0.5)
    for fold in range(n_folds):
        val_end = end - pd.Timedelta(days=int(365.25 * val_years_per_fold * (n_folds - 1 - fold)))
        val_start = val_end - pd.Timedelta(days=int(365.25 * val_years_per_fold))
        train_mask = dates < val_start
        val_mask = (dates >= val_start) & (dates < val_end)
        if train_mask.sum() < 1000 or val_mask.sum() < 100:
            continue
        yield fold, train_mask, val_mask, val_start, val_end
