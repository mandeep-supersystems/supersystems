import com.healthmarketscience.jackcess.*;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * AccdbBuilder — reads a JSON file produced by sync_accdb.py and writes a .accdb.
 *
 * JSON format:
 * [
 *   {
 *     "acc_table": "Resistor",
 *     "columns":   ["part_number", "description", "value", ...],
 *     "rows":      [["101.0.0001", "Res, 10K ...", "10K", ...], ...]
 *   },
 *   ...
 * ]
 *
 * Usage:
 *   java -jar AccdbBuilder.jar <input.json> <output.accdb>
 */
public class AccdbBuilder {

    public static void main(String[] args) throws Exception {
        if (args.length < 2) {
            System.err.println("Usage: AccdbBuilder <input.json> <output.accdb>");
            System.exit(1);
        }

        String jsonPath  = args[0];
        String accdbPath = args[1];

        // Read JSON
        String jsonStr = new String(Files.readAllBytes(Paths.get(jsonPath)), StandardCharsets.UTF_8);
        JSONArray tables = new JSONArray(jsonStr);

        File dbFile = new File(accdbPath);
        if (dbFile.exists()) dbFile.delete();

        Database db = DatabaseBuilder.create(Database.FileFormat.V2016, dbFile);

        for (int t = 0; t < tables.length(); t++) {
            JSONObject tbl      = tables.getJSONObject(t);
            String     accTable = tbl.getString("acc_table");
            JSONArray  cols     = tbl.getJSONArray("columns");
            JSONArray  rows     = tbl.getJSONArray("rows");

            // Build column list — all TEXT
            TableBuilder tb = new TableBuilder(accTable);
            for (int c = 0; c < cols.length(); c++) {
                tb.addColumn(new ColumnBuilder(cols.getString(c), DataType.TEXT).setLength((short) 255).toColumn());
            }
            Table table = tb.toTable(db);

            // Insert rows
            List<String> colNames = new ArrayList<>();
            for (int c = 0; c < cols.length(); c++) colNames.add(cols.getString(c));

            for (int r = 0; r < rows.length(); r++) {
                JSONArray row = rows.getJSONArray(r);
                Object[]  vals = new Object[colNames.size()];
                for (int c = 0; c < colNames.size(); c++) {
                    vals[c] = row.isNull(c) ? "" : row.getString(c);
                }
                table.addRow(vals);
            }
        }

        db.close();
        System.out.println("OK: " + accdbPath);
    }
}
