#!/usr/bin/env bash
# accdb_builder/setup.sh
# Downloads required JARs and compiles AccdbBuilder.java into AccdbBuilder.jar
set -e

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

echo "==> Downloading JARs..."

JARS=(
  "https://repo1.maven.org/maven2/com/healthmarketscience/jackcess/jackcess/4.0.7/jackcess-4.0.7.jar"
  "https://repo1.maven.org/maven2/org/apache/commons/commons-lang3/3.14.0/commons-lang3-3.14.0.jar"
  "https://repo1.maven.org/maven2/commons-logging/commons-logging/1.3.0/commons-logging-1.3.0.jar"
  "https://repo1.maven.org/maven2/org/json/json/20240303/json-20240303.jar"
)

for url in "${JARS[@]}"; do
  fname=$(basename "$url")
  if [ ! -f "$fname" ]; then
    echo "  Downloading $fname"
    curl -fsSL -o "$fname" "$url"
  else
    echo "  Already exists: $fname"
  fi
done

CP="jackcess-4.0.7.jar:commons-lang3-3.14.0.jar:commons-logging-1.3.0.jar:json-20240303.jar"

echo "==> Compiling AccdbBuilder.java..."
javac -cp "$CP" AccdbBuilder.java
if [ $? -ne 0 ]; then
  echo "ERROR: Compilation failed. Make sure you run this script from accdb_builder/ directory."
  exit 1
fi

echo "==> Packaging AccdbBuilder.jar..."
mkdir -p _stage
for jar in jackcess-4.0.7.jar commons-lang3-3.14.0.jar commons-logging-1.3.0.jar json-20240303.jar; do
  (cd _stage && jar xf "../$jar")
done
cp AccdbBuilder*.class _stage/

echo "Main-Class: AccdbBuilder" > _stage/MANIFEST.MF

jar cfm AccdbBuilder.jar _stage/MANIFEST.MF -C _stage .
rm -rf _stage AccdbBuilder*.class

echo "==> Done: AccdbBuilder.jar"
