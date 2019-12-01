################################################################################
#
# Copyright (c) 2019, the Perspective Authors.
#
# This file is part of the Perspective library, distributed under the terms of
# the Apache License 2.0.  The full license can be found in the LICENSE file.
#

import six
import time
import numpy
from pandas import Period
from datetime import date, datetime
from re import search
from dateutil.parser import parse

try:
    from .libbinding import t_dtype
except ImportError:
    pass

if six.PY2:
    from past.builtins import long


def _normalize_timestamp(obj):
    '''Convert a timestamp in seconds to milliseconds.

    If the input overflows, it is treated as milliseconds - otherwise it is
    treated as seconds and converted.
    '''
    try:
        datetime.fromtimestamp(obj)
        return int(obj * 1000)
    except (ValueError, OverflowError):
        return int(obj)


class _PerspectiveDateValidator(object):
    '''Validate and parse dates using the `dateutil` package.'''

    def parse(self, str):
        '''Return a datetime.datetime object containing the parsed date, or
        None if the date is invalid.

        If a ISO date string with a timezone is provided, there is no guarantee
        that timezones will be properly handled, as the core engine stores the
        timestamp as milliseconds since epoch. When a datetime is retrieved from
        the engine, it is constructed with the timestamp, thus any timezone set
        on the input data will not apply to the output data.

        Args:
            str (str): the datestring to parse

        Returns:
            (:class:`datetime.date`/`datetime.datetime`/`None`): if parse is
                successful.
        '''
        try:
            return parse(str)
        except (ValueError, OverflowError):
            return None

    def to_date_components(self, obj):
        '''Return a dictionary of string keys and integer values for `year`,
        `month`, and `day`.

        This method converts both datetime.date and numpy.datetime64 objects
        that contain datetime.date.
        '''
        if obj is None:
            return obj

        if isinstance(obj, (int, float)):
            obj = datetime.fromtimestamp(_normalize_timestamp(obj) / 1000)

        if six.PY2:
            if isinstance(obj, (long)):
                obj = datetime.fromtimestamp(long(obj))

        if isinstance(obj, numpy.datetime64):
            if str(obj) == "NaT":
                return None
            obj = obj.astype(datetime)

            if (six.PY2 and isinstance(obj, long)) or isinstance(obj, int):
                obj = datetime.fromtimestamp(obj / 1000000000)

        return {
            "year": obj.year,
            "month": obj.month,
            "day": obj.day
        }

    def to_timestamp(self, obj):
        '''Return an integer that corresponds to the Unix timestamp, i.e.
        number of milliseconds since epoch.

        This method converts both datetime.datetime and numpy.datetime64
        objects.
        '''
        if obj is None:
            return obj

        if obj.__class__.__name__ == "date":
            # handle updating datetime with date object
            obj = datetime(obj.year, obj.month, obj.day)

        if isinstance(obj, Period):
            # extract the start of the Period
            obj = obj.to_timestamp()

        if six.PY2:
            if isinstance(obj, long):
                # compat with python2 long from datetime.datetime
                obj = obj / 1000000000
                return long(obj)

        if isinstance(obj, numpy.datetime64):
            if str(obj) == "NaT":
                return None

            # astype(datetime) returns an int or a long (in python 2)
            obj = obj.astype(datetime)

            if isinstance(obj, date) and not isinstance(obj, datetime):
                # handle numpy "datetime64[D/W/M/Y]" - mktime output in seconds
                return int((time.mktime(obj.timetuple())) * 1000)

            if six.PY2:
                if isinstance(obj, long):
                    return long(round(obj / 1000000))

            if isinstance(obj, int):
                return round(obj / 1000000)

        if isinstance(obj, (int, float)):
            return _normalize_timestamp(obj)

        return int((time.mktime(obj.timetuple()) + obj.microsecond / 1000000.0) * 1000)
        # Convert `datetime.datetime` and `pandas.Timestamp` to millisecond
        # timestamps

    def format(self, s):
        '''Return either t_dtype.DTYPE_DATE or t_dtype.DTYPE_TIME depending on
        the format of the parsed date.

        If the parsed date is invalid, return t_dtype.DTYPE_STR to prevent
        further attempts at conversion.  Attempt to use heuristics about dates
        to minimize false positives, i.e. do not parse dates without separators.

        Args:
            str (str): the datestring to parse.
        '''
        if isinstance(s, (bytes, bytearray)):
            s = s.decode("utf-8")
        has_separators = bool(search(r"[/. -]", s))  # match commonly-used date separators
        # match commonly-used date separators

        dtype = t_dtype.DTYPE_STR

        if has_separators:
            try:
                parsed = parse(s)
                if (parsed.hour, parsed.minute, parsed.second, parsed.microsecond) == (0, 0, 0, 0):
                    dtype = t_dtype.DTYPE_DATE
                else:
                    dtype = t_dtype.DTYPE_TIME
            except (ValueError, OverflowError):
                # unparsable dates should be coerced to string
                dtype = t_dtype.DTYPE_STR

        return dtype
