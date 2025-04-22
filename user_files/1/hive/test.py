from pyspark import SparkContext
import logging

# Create SparkContext
sc = SparkContext(appName="MyApp")

# Set log level to ERROR (if supported)
try:
    sc.setLogLevel("ERROR")
except AttributeError:
    # Fallback for older Spark 1.x versions
    logger = sc._jvm.org.apache.log4j
    logger.LogManager.getRootLogger().setLevel(logger.Level.ERROR)

# Example RDD operation
rdd = sc.parallelize([1, 2, 3, 4])
print(rdd.collect())

sc.stop()

