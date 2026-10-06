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

echo "==> Compiling AccdbBuilder.java..."
CP="jackcess-4.0.7.jar:commons-lang3-3.14.0.jar:commons-logging-1.3.0.jar:json-20240303.jar"
javac -cp "$CP" AccdbBuilder.java

echo "==> Packaging AccdbBuilder.jar..."
# Extract dependency classes into a staging dir
mkdir -p _stage
for jar in jackcess-4.0.7.jar commons-lang3-3.14.0.jar commons-logging-1.3.0.jar json-20240303.jar; do
  (cd _stage && jar xf "../$jar")
done
cp AccdbBuilder*.class _stage/

# Create manifest
echo "Main-Class: AccdbBuilder" > _stage/MANIFEST.MF

# Build fat JAR
jar cfm AccdbBuilder.jar _stage/MANIFEST.MF -C _stage .
rm -rf _stage AccdbBuilder*.class

echo "==> Done: AccdbBuilder.jar"
