from datetime import datetime
from sortedcontainers import SortedSet
from typing import List, Set, Dict, Callable, Optional
import logging

class TimedataManager:
    def __init__(self):
        self._config_timedata_ids = []
        self._raw_timedatas = []
        self.timedatas = SortedSet()

    def add_timedata(self, timedata):
        self._raw_timedatas.append(timedata)
        self.update_sorted_timedatas()

    def remove_timedata(self, timedata):
        self._raw_timedatas.remove(timedata)
        self.update_sorted_timedatas()

    def update_sorted_timedatas(self):
        self.timedatas = SortedSet(
            sorted(self._raw_timedatas, key=lambda t: self._config_timedata_ids.index(t.id) 
                   if t.id in self._config_timedata_ids else t.id)
        )

    def activate(self, config_timedata_ids: List[str]):
        self._config_timedata_ids = config_timedata_ids
        self.update_sorted_timedatas()

    def query_historic_data(self, edge_id: str, from_date: datetime, to_date: datetime,
                            channels: Set[str], resolution: str) -> Dict[datetime, Dict[str, str]]:
        try:
            return self.first_of(lambda t: t.query_historic_data(edge_id, from_date, to_date, channels, resolution))
        except Exception as e:
            logging.warning(f"No timedata result for 'query_historic_data' on Edge={edge_id}; FromDate={from_date}; "
                            f"ToDate={to_date}; Channels={channels}; Resolution={resolution}")
            raise RuntimeError("Unable to query historic data. Result is null")

    def query_historic_energy(self, edge_id: str, from_date: datetime, to_date: datetime,
                              channels: Set[str]) -> Dict[str, str]:
        try:
            return self.first_of(lambda t: t.query_historic_energy(edge_id, from_date, to_date, channels))
        except Exception as e:
            logging.warning(f"No timedata result for 'query_historic_energy' on Edge={edge_id}; FromDate={from_date}; "
                            f"ToDate={to_date}; Channels={channels}")
            raise RuntimeError("Unable to query historic energy. Result is null")

    def query_historic_energy_per_period(self, edge_id: str, from_date: datetime, to_date: datetime,
                                         channels: Set[str], resolution: str) -> Dict[datetime, Dict[str, str]]:
        try:
            return self.first_of(lambda t: t.query_historic_energy_per_period(edge_id, from_date, to_date, channels, resolution))
        except Exception as e:
            logging.warning(f"No timedata result for 'query_historic_energy_per_period' on Edge={edge_id}; "
                            f"FromDate={from_date}; ToDate={to_date}; Channels={channels}; Resolution={resolution}")
            raise RuntimeError("Unable to query historic energy per period. Result is null")

    def query_first_value_before(self, edge_id: str, date: datetime, channels: Set[str]) -> Dict[str, str]:
        try:
            return self.first_of(lambda t: t.query_first_value_before(edge_id, date, channels))
        except Exception as e:
            logging.warning(f"No timedata result for 'query_first_value_before' on Edge={edge_id}; Date={date}; Channels={channels}")
            raise RuntimeError("Unable to query first value before. Result is null")

    def first_of(self, function: Callable) -> Optional:
        errors = []
        for timedata in self.timedatas:
            try:
                result = function(timedata)
                if result is not None:
                    return result
            except Exception as e:
                logging.info(f"{timedata.id}: {str(e)}")
                errors.append(e)
        
        if errors:
            raise RuntimeError("Errors occurred: " + "; ".join(str(e) for e in errors))
        return None

    def write(self, edge_id: str, data, method: Callable):
        for timedata in self.timedatas:
            try:
                method(timedata, edge_id, data)
            except Exception as e:
                logging.warning(f"Timedata write failed for Edge={edge_id}")
