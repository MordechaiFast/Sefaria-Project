# -*- coding: utf-8 -*-

"""
trend.py
"""

import time
from datetime import datetime

from . import abstract as abst
from . import user_profile
from . import text

from sefaria.system.database import db

import logging
logger = logging.getLogger(__name__)


def read_in_category_key(c):
    return "ReadInCategory" + c


def reverse_read_in_category_key(k):
    return k[14:]


def get_session_traits(request, uid=None):
    # keys for these traits are duplicated in story editor.  Could be more graceful.

    traits = {
        "inDiaspora": bool(request.diaspora),
        "inIsrael": not request.diaspora,
    }
    if uid is not None:
        traits.update({
            "readsHebrew":                  Trend.get_user_trend_value(uid, "HebrewAbility") >= .5,
            "toleratesEnglish":             Trend.get_user_trend_value(uid, "EnglishTolerance") >= .05,
            "usesSheets":                   Trend.get_user_trend_value(uid, "SheetsRead") >= 2,
        })

        # "createsSheets"
        # "prefersBilingual"
        # "isSephardi"
        # "learnsDafYomi", etc

    return [k for k, v in traits.items() if v]


class DateRange(object):
    def __init__(self, key, start=None, end=None):
        """
        :param start: datetime or None, meaning open ended
        :param end: datetime or None, meaning open ended
        """
        self.start = start
        self.end = end
        self.key = key

    @classmethod
    def alltime(cls):
        return cls("alltime", None, None)

    @classmethod
    def this_hebrew_year(cls):
        #todo: improve me!
        return cls("this_hebrew_year", datetime(2018, 9, 10), datetime(2019, 9, 29))

#       "5780": DateRange(datetime(2019, 9, 30), datetime(2020, 9, 18))

    def needs_clause(self):
        return self.start or self.end

    def query_clause(self):
        """
        Returns a time range clause, fit for use in a pymongo query
        :param start: datetime
        :param end: datetime
        :return:
        """
        if self.start is None and self.end is None:
            return {}

        timeclause = {}
        if self.start:
            timeclause["$gte"] = self.start
        if self.end:
            timeclause["$lte"] = self.end
        return timeclause

    def update_match(self, match_clause, field="datetime"):
        """
        Update a mongo query dict with a time period query
        :param match_clause: dict
        :param field: the field to match in this query
        :return: dict (though it's been updated in place)
        """
        if self.needs_clause():
            match_clause[field] = self.query_clause()
        return match_clause

    def contains(self, dt):
        """
        Check if the supplied datetime falls in this range
        :param dt:
        :return:
        """
        return ((self.start is None or self.start <= dt)
                and (self.end is None or dt <= self.end))


active_dateranges = [DateRange.alltime(), DateRange.this_hebrew_year()]


class Trend(abst.AbstractMongoRecord):
    '''
    Value
    Timestamp
    Period Covered [week, month, season, alltime, this_hebrew_year]
    Scope [user, user network, comparable, site]
    '''

    collection   = 'trend'
    history_noun = 'trend'

    required_attrs = [
        "name",
        "value",
        "datatype",  # from factory.  needed?
        "timestamp",
        "period",    #
        "scope"
    ]

    optional_attrs = [
        "uid"       # Required when scope is not "site"
    ]

    @classmethod
    def get_user_trend_value(cls, uid, name, period="alltime", default=0):
        trend = cls().load({"uid": uid, "name": name, "period": period})
        if trend:
            return trend.value
        else:
            return default

    def _init_defaults(self):
        self.timestamp = int(time.time())

    def _validate(self):
        assert self.scope == "site" or hasattr(self, "uid")


class TrendSet(abst.AbstractMongoSet):
    recordClass = Trend


def setUserSheetTraits():
    TrendSet({"name": "SheetsRead"}).delete()

    for daterange in active_dateranges:
        all_users = getAllUsersSheetUsage(daterange)
        for uid, data in all_users.iteritems():
            Trend({
                "name":         "SheetsRead",
                "value":        int(data["cnt"]),
                "datatype":     "int",
                "timestamp":    datetime.utcnow(),
                "period":       daterange.key,
                "scope":        "user",
                "uid":          uid
            }).save()


def setCategoryTraits():
    from sefaria.model.category import TOP_CATEGORIES

    TrendSet({"name": {"$in": map(read_in_category_key, TOP_CATEGORIES)}}).delete()

    site_data = {cat: 0 for cat in TOP_CATEGORIES}

    # User Traits
    for daterange in active_dateranges:
        all_users = getAllUsersCategories(daterange)
        for uid, data in all_users.iteritems():
            for cat, val in data["categories"].items():
                if cat not in TOP_CATEGORIES:
                    continue
                Trend({
                    "name":         read_in_category_key(cat),
                    "value":        val,
                    "datatype":     "int",
                    "timestamp":    datetime.utcnow(),
                    "period":       daterange.key,
                    "scope":        "user",
                    "uid":          uid
                }).save()
                site_data[cat] += val

        # Site Traits
        for cat, val in site_data.iteritems():
            Trend({
                "name": read_in_category_key(cat),
                "value": val,
                "datatype": "int",
                "timestamp": datetime.utcnow(),
                "period": daterange.key,
                "scope": "site"
            }).save()


def setUserLanguageTraits():
    TrendSet({"name": {"$in": ["EnglishTolerance", "HebrewAbility"]}}).delete()

    for daterange in active_dateranges:
        all_users = getAllUsersLanguageUsage(daterange)
        for uid, data in all_users.iteritems():
            profile = user_profile.UserProfile(id=uid)

            he = float(data["languages"].get("hebrew", 0.0))
            en = float(data["languages"].get("english", 0.0))
            bi = float(data["languages"].get("bilingual", 0.0))
            total = float(data.get("total", 0.0))
            assert total

            # EnglishTolerance
            # If user has English interface conclude English tolerance
            if profile.settings.get("interface_language") == "english" or not he:
                value = 1.0
            else:
                # percentage of visits registered w/ English content
                value = (en + bi) / total

            Trend({
                "name":         "EnglishTolerance",
                "value":        value,
                "datatype":     "float",
                "timestamp":    datetime.utcnow(),
                "period":       daterange.key,
                "scope":        "user",
                "uid":          uid
            }).save()

            # HebrewAbility
            # If user has Hebrew interface conclude Hebrew ability
            if profile.settings.get("interface_language") == "hebrew":
                value = 1.0

            # all bi is .50,  Each he adds a bunch.  Each en takes away a bit.
            else:
                ent = en/total
                het = he/total * 5.0
                value = 0.5 + het - ent

            Trend({
                "name":         "HebrewAbility",
                "value":        value,
                "datatype":     "float",
                "timestamp":    datetime.utcnow(),
                "period":       daterange.key,
                "scope":        "user",
                "uid":          uid
            }).save()


def getAllUsersLanguageUsage(daterange):
    '''
    Returns dictionary mapping user ids to dictionaries that look like:
    {u'_id': 62298,
     u'languages': {u'bilingual': 5.0, u'hebrew': 9.0},
     u'total': 14.0}
    {u'_id': 59440, u'languages': {u'bilingual': 10.0}, u'total': 10.0}
    {u'_id': 60586, u'languages': {u'hebrew': 27.0}, u'total': 27.0}

    # https://stackoverflow.com/questions/25843255/mongodb-aggregate-count-on-multiple-fields-simultaneously
    '''

    pipeline = [
        {"$match": daterange.update_match({
            "secondary": False,
            "language": {"$in": ["hebrew", "english", "bilingual"]}
        })},
        {"$group": {
            "_id": {"language": "$language", "uid": "$uid"},
            "cnt": {"$sum": 1}}},
        {"$group": {
            "_id": "$_id.uid",
            "languages": {"$push": {"k": "$_id.language", "v": "$cnt"}},
            "total": {"$sum": "$cnt"}}},
        {"$project": {
            "languages": {"$arrayToObject": "$languages"},
            "total": "$total"}}
    ]
    results = db.user_history.aggregate(pipeline)
    return {d["_id"]: d for d in results}


def getAllUsersSheetUsage(daterange):
    pipeline = [
            {"$match": daterange.update_match({
                "secondary": False,
                "is_sheet": True
            })},
            {"$group": {
                "_id": "$uid",
                "cnt": {"$sum": 1}}}     # Sheet records never have num_times_read greater than 1.
        ]

    results = db.user_history.aggregate(pipeline)
    return {d["_id"]: d for d in results}


def getAllUsersCategories(daterange):
    pipeline = [
        {"$match": daterange.update_match({
            "secondary": False,
            "is_sheet": False,
            "categories.0": {
                "$exists": True
            }})},
        {"$group": {
            "_id": {"uid": "$uid", "category": {"$arrayElemAt" : ["$categories", 0]}},
             "cnt": { "$sum": {"$max": ["$num_times_read", 1]}}}},
             # "cnt": {"$sum": 1}}},
        {"$group": {
            "_id": "$_id.uid",
            "categories": {"$push": {"k": "$_id.category", "v": "$cnt"}},
            "total": {"$sum": "$cnt"}}},
        {"$project": {
            "categories": {"$arrayToObject": "$categories"},
            "total": "$total"}}
    ]
    results = db.user_history.aggregate(pipeline)
    return {d["_id"]: d for d in results}


# vv Needs thought / refactor vv
class TrendFactory(object):
    """
    Name
    DataType
    For Users [bool]
    For Network/Site [bool]
    """
    name = ""  # Name of trait / trend
    desc = ""  # Description of trait / trend
    datatype = ""   # int, str, bool, dict
    for_user = False   # bool
    for_group = False  # bool


    # to consider: Is a well defined period the way to go with these?
    def process_user(self, user_id, period):
        """
        f(user, period) -> val
        :param period:
        :return:
        """
        pass

    def process_user_network(self, uid, period):
        users = []  # get followed users
        return self._process_users(users, period)
        pass

    def process_comparable(self, period):
        pass

    def process_site(self, period):
        pass

    def _process_users(self, users, period):
        pass


class EnglishToleranceFactory(TrendFactory):
    name = "EnglishTolerance"
    desc = "Value between 0 and 1 - 1 Being clear English appreciation, 0 being clear English intolerance"
    datatype = "float"   # int, float, str, bool, dict
    for_user = True
    for_group = False


class HebrewAbilityFactory(TrendFactory):
    name = "HebrewAbility"
    desc = "Value between 0 and 1 - 1 Being clear Hebrew ability, 0 being clear inability"
    datatype = "float"   # int, float, str, bool, dict
    for_user = True
    for_group = False
