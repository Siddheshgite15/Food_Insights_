import unittest

from environmental.adjustment import calculate_environmental_adjustment


class EnvironmentalAdjustmentTests(unittest.TestCase):
    def test_favorable_conditions_do_not_extend_base_shelf_life(self):
        result = calculate_environmental_adjustment(15.0, 12.0, 75.0)

        self.assertEqual(result["environmentalFactor"], 1.0)
        self.assertEqual(result["adjustedRemainingDays"], 15.0)

    def test_rounding_does_not_exceed_base_shelf_life(self):
        result = calculate_environmental_adjustment(10.26, 25.0, 60.0)

        self.assertLessEqual(result["adjustedRemainingDays"], 10.26)

    def test_unfavorable_conditions_reduce_shelf_life(self):
        result = calculate_environmental_adjustment(15.0, 35.0, 60.0)

        self.assertLess(result["environmentalFactor"], 1.0)
        self.assertLess(result["adjustedRemainingDays"], 15.0)


if __name__ == "__main__":
    unittest.main()
