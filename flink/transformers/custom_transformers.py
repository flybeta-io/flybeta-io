from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import OrdinalEncoder
import numpy as np
from typing import Optional
from sklearn.utils.validation import check_is_fitted


class DelayMinSmoother(BaseEstimator, TransformerMixin):
    """
    Applies statistical smoothing (shrinkage) to delay values
    within airline–route groups to reduce the influence
    of small-sample outliers.

    Formula:
        adjusted_mean = (n / (n + k)) * group_mean + (k / (n + k)) * global_mean
    Parameters
    ----------
    group_cols : list of str, default ['airline_name', 'route']
        Columns used to define the groups.
        delay_col : str, default 'delay_min'
        Column containing raw delay values.

        k : int or float, default 19 determined from EDA
        Smoothing strength. Larger k = stronger pull toward global mean.
    """

    def __init__(self, group_cols=None, delay_col='delay_min', k=19):
        self.group_cols = group_cols or ['airline_name', 'route']
        self.delay_col = delay_col
        self.k = k

        self.global_mean_ = None
        self.group_stats_ = None

    def fit(self, X, y=None):
        df = X.copy()

        # Compute global mean
        self.global_mean_ = df[self.delay_col].mean()
        # Compute group means and counts
        group_stats = (
            df.groupby(self.group_cols)[self.delay_col]
            .agg(['mean', 'count'])
            .reset_index()
        )
        # Apply shrinkage
        group_stats['adjusted_delay_min'] = (
            (group_stats['count'] / (group_stats['count'] + self.k)) * group_stats['mean']
            + (self.k / (group_stats['count'] + self.k)) * self.global_mean_
        )
        self.group_stats_ = group_stats
        return self

    def transform(self, X):
        df = X.copy()

        # Merge adjusted delay back into data
        df = df.merge(
            self.group_stats_[self.group_cols + ['adjusted_delay_min']],
            on=self.group_cols,
            how='left'
        )
        # Fill missing values with global mean
        df['adjusted_delay_min'] = df['adjusted_delay_min'].fillna(self.global_mean_)

        # Drop delay_min
        df = df.drop(columns=[self.delay_col], errors='ignore')

        return df


class FeatureEngineeringTransformer(BaseEstimator, TransformerMixin):
    def __init__(self):
        # Learned stats
        self.route_adj_delay_mean_ = None
        self.airline_adj_delay_mean_ = None
        self.route_airline_adj_delay_mean_ = None
        self.global_adjusted_delay_mean_ = None
        self.route_counts_ = None
        self.route_median_ = None

        self.sched_dep_month_enc_ = None
        self.sched_dep_dow_enc_ = None
        self.sched_dep_time_block_enc_ = None

    def fit(self, X, y=None):
        df = X.copy()
        # Store global adjusted delay mean for fallback in transform
        self.global_adjusted_delay_mean_ = df["adjusted_delay_min"].mean()

        # --- 1. Core aggregations ---
        self.route_adj_delay_mean_ = df.groupby("route")["adjusted_delay_min"].mean().to_dict()
        self.airline_adj_delay_mean_ = df.groupby("airline_name")["adjusted_delay_min"].mean().to_dict()
        self.route_airline_adj_delay_mean_ = (
            df.groupby(["airline_name", "route"])["adjusted_delay_min"].mean().to_dict()
    )

        # --- 2. Temporal target encodings ---
        if "sched_dep_month" in df.columns:
             self.sched_dep_month_enc_ = df.groupby("sched_dep_month")["adjusted_delay_min"].mean().to_dict()
        if "sched_dep_dow" in df.columns:
            self.sched_dep_dow_enc_ = df.groupby("sched_dep_dow")["adjusted_delay_min"].mean().to_dict()
        if "sched_dep_time_block" in df.columns:
            self.sched_dep_time_block_enc_ = df.groupby("sched_dep_time_block")["adjusted_delay_min"].mean().to_dict()

        # --- 3. Route activity metrics ---
        self.route_counts_ = df["route"].value_counts()
        self.route_counts_ = df["route"].value_counts()
        self.route_median_ = self.route_counts_.median()

        return self

    def transform(self, X):
        df = X.copy()

        # --- 1. Route-level delay patterns ---
        # Map first, then fill NaNs using the pre-computed global mean
        df["route_adj_delay_mean"] = df["route"].map(self.route_adj_delay_mean_).fillna(self.global_adjusted_delay_mean_)
        df["airline_adj_delay_mean"] = df["airline_name"].map(self.airline_adj_delay_mean_).fillna(self.global_adjusted_delay_mean_)

        df["route_airline_adj_delay_mean"] = df.apply(
            lambda r: self.route_airline_adj_delay_mean_.get((r["airline_name"], r["route"]), np.nan),
            axis=1
        )
        df["route_airline_adj_delay_mean"] = df["route_airline_adj_delay_mean"].fillna(self.global_adjusted_delay_mean_)
        # --- 2. Temporal encodings ---
        if self.sched_dep_month_enc_:
            df["sched_dep_month_enc"] = df["sched_dep_month"].map(self.sched_dep_month_enc_).fillna(self.global_adjusted_delay_mean_)
        if self.sched_dep_dow_enc_:
            df["sched_dep_dow_enc"] = df["sched_dep_dow"].map(self.sched_dep_dow_enc_).fillna(self.global_adjusted_delay_mean_)
        if self.sched_dep_time_block_enc_:
            df["sched_dep_time_block_enc"] = df["sched_dep_time_block"].map(self.sched_dep_time_block_enc_).fillna(self.global_adjusted_delay_mean_)

        # --- 3. Weather differentials ---
        df["temp_diff"] = df["origin_temp_c"] - df["dest_temp_c"]
        df["visibility_diff"] = df["origin_visibility_km"] - df["dest_visibility_km"]
        df["wind_speed_diff"] = df["origin_wind_speed_kmph"] - df["dest_wind_speed_kmph"]
        df["precip_prob_diff"] = df["origin_precip_prob_pct"] - df["dest_precip_prob_pct"]

        # --- 4. Weather stress indices ---
        df["origin_weather_index"] = (
            0.4 * df["origin_wind_speed_kmph"]
            + 0.3 * df["origin_precip_prob_pct"]
            + 0.3 * df["origin_cloud_cover_pct"]
            )
        df["dest_weather_index"] = (
            0.4 * df["dest_wind_speed_kmph"]
            + 0.3 * df["dest_precip_prob_pct"]
            + 0.3 * df["dest_cloud_cover_pct"]
        )

        # --- 5. Route / airline intensity ---
        df["route_freq"] = df["route"].map(self.route_counts_)
        df["is_busy_route"] = (df["route_freq"] > self.route_median_).astype(int)

        # --- 6. Cleanup ---
        df = df.fillna(0)

        df = df.drop(
            columns=[
                    "originIata", "destIata", "sched_dep_month", "sched_dep_dow", "sched_dep_time_block",
                    "sched_dep_hour", "adjusted_delay_min", "sched_dep_date"
                    ],
            errors="ignore"
            )

        return df
# "sched_dep_time", "sched_arr_time", "flight_id", "airline_iata_code", "route"

class OrdinalEncoderTransformer(BaseEstimator, TransformerMixin):
    """
    Simple wrapper around Sklearn's OrdinalEncoder to work with DataFrames.
    """
    def __init__(self, cols=None):
        self.cols = cols or []
        self.encoder_: Optional[OrdinalEncoder] = None

    def fit(self, X, y=None):
        df = X.copy()
        self.encoder_ = OrdinalEncoder(
            handle_unknown="use_encoded_value",
            unknown_value=-1
        )
        self.encoder_.fit(df[self.cols].astype(str))
        return self

    def transform(self, X):
        check_is_fitted(self, 'encoder_')
        df = X.copy()
        df[self.cols] = self.encoder_.transform(df[self.cols].astype(str))
        return df
