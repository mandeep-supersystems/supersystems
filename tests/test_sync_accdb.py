import unittest

from modules.part.sync_accdb import (
    _CIS_ACC_TABLE,
    _extract_cis_manufacturer_parts,
    _extract_data,
)


class _Result:
    def fetchall(self):
        return [('P-1', 'Maker', 'M-1', 'Active', '')]


class _Session:
    def execute(self, query, params=None):
        return _Result()

    def commit(self):
        pass

    def rollback(self):
        pass


class _DB:
    session = _Session()

    @staticmethod
    def text(query):
        return query


class SyncAccdbTests(unittest.TestCase):
    def test_cis_table_export_uses_exact_access_table_name(self):
        table = _extract_cis_manufacturer_parts(_DB())

        self.assertEqual(table['acc_table'], 'Cis Manufacturer Parts')
        self.assertEqual(table['acc_table'], _CIS_ACC_TABLE)

    def test_legacy_misspelled_category_is_not_exported_separately(self):
        categories = [(1, 'cis_manufactureer_parts', '', '', [])]

        self.assertEqual(_extract_data(None, categories), [])


if __name__ == '__main__':
    unittest.main()
