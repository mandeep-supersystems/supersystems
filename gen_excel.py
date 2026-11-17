import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

wb = openpyxl.Workbook()
ws = wb.active
ws.title = 'CadDB Fields'

hdr_font = Font(bold=True, color='FFFFFF')
hdr_fill = PatternFill('solid', fgColor='2F5496')
hdr_align = Alignment(horizontal='center', vertical='center', wrap_text=True)

headers = ['Category', 'Part Number', 'Description', 'Custom Columns (in order)', 'PCB Footprint', 'Step 3D File']
for i, h in enumerate(headers, 1):
    c = ws.cell(row=1, column=i, value=h)
    c.font = hdr_font
    c.fill = hdr_fill
    c.alignment = hdr_align
ws.row_dimensions[1].height = 30

data = [
    ('Antenna', 'Antenna Type, Value'),
    ('Assembly', 'Value, Description'),
    ('Bare PCB', ''),
    ('Bolt', 'Size, Length, Material, Finish/Coating, Remarks'),
    ('Cable', 'Connector 1, Core, Connector 2, Wire Size, Length, Color, Make, Remark'),
    ('Capacitor', 'SS PN, Value, Company Part Status, Mounting Type, No of Pins, Package Size, Package Height, Operating Temperature, Voltage, Tolerance'),
    ('Chemicals', 'Type, Form, Dia'),
    ('Connector', 'Gender, No Of Pins, Pitch, No Of Rows, Orientation, Connector Type, Remark'),
    ('Crimping Pin', ''),
    ('Din Rail Mount Hardware', 'Size, Length, Material, Finish/Coating, Remarks'),
    ('Diode', 'Value, Schematic Part, Company Part Status, Mounting Type, No Of Pins, Package Size, Package Height, Operating Temperature, Diode Configuration, Forward Current, Reverse Voltage, Forward Voltage, Surge Current'),
    ('Fan', 'Value, Remark, Operating Voltage, Current Rating, Size Mm'),
    ('Grommet', 'Inner Dia, Length, Material, Finish/Coating, Remarks, Outer Dia, Panel Thickness'),
    ('Header', 'Gender, No Of Pins, Pitch, No Of Rows, Orientation, Connector Type, Height, Remark'),
    ('Heat Shrink Sleeve', 'Size, Colour, Material'),
    ('Heatsink', 'Length, Height, Where Used'),
    ('IC', 'Value, Mounting Type, No Of Pins, Operating Temperature, Package'),
    ('IC2', ''),
    ('Inductor', 'Value, Mounting Type, Core, No. of Pins, Bobbin'),
    ('Insulator', ''),
    ('LCD Module', 'Value, Remarks'),
    ('LED', 'Package, Color, Size, Remarks'),
    ('Magnetics - Bobbin', 'Value, Bobbin Type'),
    ('Magnetics - Cores', 'Value, Core Type'),
    ('Magnetics Tape', 'Type, Material, Width, Thickness, Colour'),
    ('Magnetic Insulations', 'Type, Thickness, Material, Colour, Size'),
    ('Mechanical', 'Value, Material, Thickness, Finish'),
    ('Module', 'Value'),
    ('MOSFET', 'Value, Company Part Status, Mounting Type, No Of Pins, Operating Temperature, Package Size, Package Height, Rdson, Drain Source Voltage, Power Dissipation, Drain Current, Vgs Threshold, Gate Charge'),
    ('Motor', 'Voltage, Current Rating, Torque'),
    ('Nut', 'Size, Length, Material, Finish/Coating, Remarks'),
    ('PCB', 'Value, No. Of Layer, Thickness, Size'),
    ('Power IC', 'Value, Mounting Type, No Of Pins, Operating Temperature, Package'),
    ('Protection', 'Value, Mounting Type, Rated Voltage, Current, Remark'),
    ('Relay', 'Value, Mounting Type, No Of Pins, Operating Temperature, Current Rating, Coil Voltage, Coil Power'),
    ('Resistor', 'SS PN, Value, Schematic Part, Company Part Status, Mounting Type, No Of Pins, Operating Temperature, Package Size, Tolerance, Rated Power, Rated Voltage'),
    ('Revit', 'Value, Dia, Length, Material'),
    ('Screw', 'Size, Length, Material, Finish/Coating, Remarks'),
    ('Sensor', 'Mounting Type, No Of Pins, Operating Temperature, Value, Current Rating, Coil Voltage, Coil Power'),
    ('Spacer', 'Size, Length, Material, Finish/Coating, Remarks, Type'),
    ('Stickers', 'Value, Material, Adhesive Type, Print Format'),
    ('Switch', 'Value, Remark'),
    ('Thermal', 'Type, Material, Size, Th. Conductivity, Thickness'),
    ('Thermistor', 'Value, Mounting Type, Resistance, Diameter'),
    ('Thimble', 'Size, Length, Material, Finish/Coating, Remarks'),
    ('Transformer', 'Bobbin, Core, No. of Pins, Mounting Type, Used in PCB'),
    ('Transistor', 'Value, Schematic Part, Company Part Status, Operating Temperature, Package Size, Package Height, Mounting Type, No Of Pins, Collector Emitter Voltage, Emitter Base Voltage, Collector Emitter Saturation Voltage, Dc Collector Current, Gain Hfe'),
    ('Washer', 'Size, Length, Material, Finish/Coating, Remarks'),
    ('Wire', 'Material, Insulation Type, Wire Gauge'),
]

alt_fill = PatternFill('solid', fgColor='DCE6F1')
for row_idx, (cat, cols) in enumerate(data, 2):
    fill = alt_fill if row_idx % 2 == 0 else PatternFill('solid', fgColor='FFFFFF')
    for ci, val in enumerate([cat, 'part_number', 'description', cols, 'pcb_footprint', 'step_3d_file'], 1):
        c = ws.cell(row=row_idx, column=ci, value=val)
        c.fill = fill
        if ci == 4:
            c.alignment = Alignment(wrap_text=True)

ws.column_dimensions['A'].width = 28
ws.column_dimensions['B'].width = 16
ws.column_dimensions['C'].width = 16
ws.column_dimensions['D'].width = 80
ws.column_dimensions['E'].width = 18
ws.column_dimensions['F'].width = 18

ws2 = wb.create_sheet('cis_manufacturer_parts')
for i, h in enumerate(['Part Number', 'Manufacturer', 'Manufacturer PN', 'Manufacturer PN Status', 'Datasheet'], 1):
    c = ws2.cell(row=1, column=i, value=h)
    c.font = hdr_font
    c.fill = hdr_fill
    c.alignment = hdr_align
ws2.cell(row=2, column=1, value='(all parts with MPN data from part.manufacturers)')
for col in ['A','B','C','D','E']:
    ws2.column_dimensions[col].width = 26

wb.save(r'c:\Users\mande\OneDrive\Desktop\CadDB_Fields.xlsx')
print('Saved to Desktop')
