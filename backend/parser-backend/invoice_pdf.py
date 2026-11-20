"""invoice_pdf.py - renders the printed GST tax invoice as PDF bytes.

Layout ported from the standalone invoice engine. Differences: shop details come
from the business profile instead of config.py, nothing is written to disk, and
every user-supplied string is XML-escaped before it reaches ReportLab (an '&' or
'<' in a customer name would otherwise break the build).
Python 3.9 compatible. Needs reportlab only.
"""
import io
from xml.sax.saxutils import escape as _esc

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_RIGHT


FULL_WIDTH_MM = 194  # every stacked table section must sum to exactly this width


def _e(x):
    return _esc(str(x))


def render_invoice_pdf(biz, header, invoice):
    """Returns the PDF as bytes. Nothing is written to disk.

    biz:     business_name, address, phone, gstin, tagline, upi_id, bank_name,
             bank_branch, terms (list of str), logo_bytes, qr_bytes (last two optional)
    header:  customer_name, customer_address, customer_gstin
    invoice: the dict returned by invoice_gen.build_invoice
    """
    enriched_items, totals = invoice["lines"], invoice["totals"]
    inv_no = invoice["invoice_number"]
    date_s = invoice["invoice_date"].strftime("%d-%b-%Y")
    due_s = invoice["due_date"].strftime("%d-%b-%Y")
    pay = invoice["payment_label"]
    buf = io.BytesIO()
    styles = getSampleStyleSheet()
    normal = ParagraphStyle('n', parent=styles['Normal'], fontSize=8.5, leading=11)
    normal_b = ParagraphStyle('nb', parent=styles['Normal'], fontSize=8.5, leading=11, fontName='Helvetica-Bold')
    center_title = ParagraphStyle('ct', parent=styles['Normal'], fontSize=11, alignment=TA_CENTER, fontName='Helvetica-Bold')
    company_name_style = ParagraphStyle('cn', parent=styles['Normal'], fontSize=19, alignment=TA_CENTER, fontName='Helvetica-Bold')
    company_sub_style = ParagraphStyle('cs', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER)
    tag_style = ParagraphStyle('tag', parent=styles['Normal'], fontSize=9, alignment=TA_CENTER,
                                textColor=colors.HexColor('#B85C00'))
    ih_style = ParagraphStyle('ih', parent=normal_b, fontSize=7.5, alignment=TA_CENTER)

    doc = SimpleDocTemplate(buf, pagesize=A4,
                             topMargin=8 * mm, bottomMargin=8 * mm, leftMargin=8 * mm, rightMargin=8 * mm)
    story = []

    # ================================================================
    # SECTION 1 — Top bar + Company header + Billing/Invoice meta
    # (194mm wide, owns the TOP border of the whole document)
    # ================================================================
    data = []
    spans = []
    row = 0

    data.append([
        Paragraph('Page No. 1 of 1', normal),
        Paragraph('TAX INVOICE', center_title), '',
        Paragraph('ORIGINAL FOR<br/>RECIPIENT', ParagraphStyle('r', parent=normal, alignment=TA_RIGHT, fontSize=7.5)),
    ])
    spans.append(('SPAN', (1, row), (2, row)))
    row += 1

    logo_cell = Image(io.BytesIO(biz['logo_bytes']), width=24 * mm, height=24 * mm) if biz.get('logo_bytes') else ''
    company_block = [
        Paragraph(_e(biz['business_name']).upper(), company_name_style),
        Paragraph(_e(biz.get('address') or ''), company_sub_style),
        Paragraph(_e("Mobile: %s | GSTIN: %s" % (biz.get('phone') or '-', biz.get('gstin') or 'Unregistered')), company_sub_style),
        Paragraph(_e(biz.get('tagline') or ''), tag_style),
    ]
    company_inner = Table([[c] for c in company_block], colWidths=[FULL_WIDTH_MM * mm - 30 * mm],
                           rowHeights=[9 * mm, 5 * mm, 5 * mm, 5 * mm])
    company_inner.setStyle(TableStyle([
        ('TOPPADDING', (0, 0), (-1, -1), 1), ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    data.append([logo_cell, company_inner, '', ''])
    spans.append(('SPAN', (1, row), (3, row)))
    row += 1

    billing_block = Table([
        [Paragraph('<b>Billing Details</b>', normal_b)],
        [Paragraph('<b>Name:</b> ' + _e(header['customer_name']), normal)],
        [Paragraph("GSTIN: %s" % _e(header.get('customer_gstin') or 'Unregistered Dealer'), normal)],
        [Paragraph(_e(header.get('customer_address') or ''), normal)],
    ], colWidths=[100 * mm])
    billing_block.setStyle(TableStyle([('TOPPADDING', (0, 0), (-1, -1), 1), ('BOTTOMPADDING', (0, 0), (-1, -1), 1)]))

    meta_rows = [
        ('Invoice Number', inv_no),
        ('Invoice Date', date_s),
        ('Due Date', due_s),
        ('Payment Mode', pay),
        ('Place of Supply', biz.get('place_of_supply') or 'Intra-state'),
        ('Reverse Charge', 'No'),
    ]
    meta_block = Table([[Paragraph(f'<b>{k}</b>', normal_b), Paragraph(': ' + v, normal)] for k, v in meta_rows],
                        colWidths=[32 * mm, 62 * mm])
    meta_block.setStyle(TableStyle([('TOPPADDING', (0, 0), (-1, -1), 1), ('BOTTOMPADDING', (0, 0), (-1, -1), 1),
                                     ('VALIGN', (0, 0), (-1, -1), 'TOP')]))

    data.append([billing_block, '', meta_block, ''])
    spans.append(('SPAN', (0, row), (1, row)))
    spans.append(('SPAN', (2, row), (3, row)))

    header_table = Table(data, colWidths=[35 * mm, 97 * mm, 31 * mm, 31 * mm])
    header_table.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (-1, 0), 1, colors.black),
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.black),
        ('LINEBEFORE', (0, 0), (0, -1), 1, colors.black),
        ('LINEAFTER', (-1, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.6, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ] + spans))
    story.append(header_table)

    # ================================================================
    # SECTION 2 — Item table (194mm wide — MUST match header/footer exactly)
    # ================================================================
    item_widths = [8 * mm, 41 * mm, 16 * mm, 10 * mm, 10 * mm, 16 * mm, 17 * mm,
                   12 * mm, 16 * mm, 12 * mm, 16 * mm, 20 * mm]
    assert abs(sum(item_widths) - FULL_WIDTH_MM * mm) < 0.01, "item_widths must sum to FULL_WIDTH_MM"

    raw_header = ['Sr.', 'Item Description', 'HSN/SAC', 'Qty', 'Unit', 'Rate (Rs)', 'Taxable\nValue',
                  'CGST %', 'CGST Amt', 'SGST %', 'SGST Amt', 'Total (Rs)']
    item_header_row = [Paragraph(f'<b>{h}</b>', ih_style) if '\n' in h else h for h in raw_header]
    item_data = [item_header_row]

    # Item Description MUST be a Paragraph, not a plain string - plain strings never wrap
    # inside a ReportLab Table cell and will overflow into the neighbouring column
    # (this previously caused item names to draw on top of the HSN code).
    item_desc_style = ParagraphStyle('idesc', parent=normal, fontSize=7.5, leading=9)

    for i, item in enumerate(enriched_items, start=1):
        item_data.append([
            str(i), Paragraph(_e(item['name']), item_desc_style), item['hsn'],
            f"{item['qty']:.2f}", item['unit'],
            f"{item['rate']:.2f}", f"{item['taxable_value']:.2f}",
            f"{item['cgst_rate']:.1f}", f"{item['cgst_amount']:.2f}",
            f"{item['sgst_rate']:.1f}", f"{item['sgst_amount']:.2f}",
            f"{item['line_total']:.2f}",
        ])
    for _ in range(4):  # fixed 4 blank padding rows, matching the approved reference template exactly
        item_data.append([''] * 12)

    item_table = Table(item_data, colWidths=item_widths)
    item_table.setStyle(TableStyle([
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.black),
        ('LINEBEFORE', (0, 0), (0, -1), 1, colors.black),
        ('LINEAFTER', (-1, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.black),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 7.5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ALIGN', (3, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (5, 0), (6, -1), 'RIGHT'),
        ('ALIGN', (8, 0), (8, -1), 'RIGHT'),
        ('ALIGN', (10, 0), (11, -1), 'RIGHT'),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(item_table)

    # ================================================================
    # SECTION 3 — Totals rows
    # ================================================================
    totals_data = [
        ['', 'Taxable Value', '', '', '', '', '', '', '', '', '', f"{totals['subtotal']:.2f}"],
        ['', 'Total CGST', '', '', '', '', '', '', '', '', '', f"{totals['cgst_total']:.2f}"],
        ['', 'Total SGST', '', '', '', '', '', '', '', '', '', f"{totals['sgst_total']:.2f}"],
        ['', 'Discount', '', '', '', '', '', '', '', '', '', "0.00"],
    ]
    totals_table = Table(totals_data, colWidths=item_widths)
    totals_table.setStyle(TableStyle([
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.black),
        ('LINEBEFORE', (0, 0), (0, -1), 1, colors.black),
        ('LINEAFTER', (-1, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.black),
        ('FONTSIZE', (0, 0), (-1, -1), 8.5),
        ('ALIGN', (11, 0), (11, -1), 'RIGHT'),
        ('FONTNAME', (1, 0), (1, -1), 'Helvetica-Bold'),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(totals_table)

    total_row_table = Table([['Total', '', '', '', '', '', '', '', '', '', '', f"Rs {totals['grand_total']:.2f}"]],
                             colWidths=item_widths)
    total_row_table.setStyle(TableStyle([
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.black),
        ('LINEBEFORE', (0, 0), (0, -1), 1, colors.black),
        ('LINEAFTER', (-1, 0), (-1, -1), 1, colors.black),
        ('SPAN', (0, 0), (1, 0)),
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#EFEFEF')),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 11),
        ('ALIGN', (11, 0), (11, 0), 'RIGHT'),
        ('ALIGN', (0, 0), (0, 0), 'CENTER'),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(total_row_table)

    # ================================================================
    # SECTION 4 — Amount in words + settlement status
    # ================================================================
    words_data = [
        [Paragraph(f"<b>{totals['amount_in_words']}</b>", normal)],
        [Paragraph(f"<b>Settled by:</b> {pay} &nbsp;|&nbsp; "
                   f"<b>Invoice Balance:</b> Rs {totals['grand_total']:.2f} (Due {due_s})", normal)],
    ]
    words_table = Table(words_data, colWidths=[FULL_WIDTH_MM * mm])
    words_table.setStyle(TableStyle([
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.black),
        ('LINEBEFORE', (0, 0), (0, -1), 1, colors.black),
        ('LINEAFTER', (-1, 0), (-1, -1), 1, colors.black),
        ('LINEBELOW', (0, 0), (0, 0), 0.4, colors.grey),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(words_table)

    # ================================================================
    # SECTION 5 — Terms | QR + Bank | Signature (194mm wide, owns final BOTTOM border)
    # ================================================================
    terms_html = "<b>Terms and Conditions</b><br/>" + "<br/>".join(_e(t) for t in (biz.get('terms') or []))
    terms_para = Paragraph(terms_html, normal)

    qr_and_bank = Table([
        [Image(io.BytesIO(biz['qr_bytes']), width=26 * mm, height=26 * mm) if biz.get('qr_bytes') else ''],
        [Paragraph('<b>UPI ID:</b> ' + _e(biz.get('upi_id') or '-'), normal)],
        [Paragraph('<b>Bank:</b> ' + _e(biz.get('bank_name') or '-'), normal)],
        [Paragraph('<b>Branch:</b> ' + _e(biz.get('bank_branch') or '-'), normal)],
    ], colWidths=[60 * mm])
    qr_and_bank.setStyle(TableStyle([('ALIGN', (0, 0), (-1, -1), 'CENTER'), ('TOPPADDING', (0, 0), (-1, -1), 2)]))

    sig_para = Paragraph(f"<br/><br/><br/><br/>For {_e(biz['business_name'])}<br/><br/><br/>Authorised Signatory",
                          ParagraphStyle('sig', parent=normal, alignment=TA_CENTER))

    footer_table = Table([[terms_para, qr_and_bank, sig_para]], colWidths=[68 * mm, 62 * mm, 64 * mm])
    footer_table.setStyle(TableStyle([
        ('LINEBELOW', (0, -1), (-1, -1), 1, colors.black),
        ('LINEBEFORE', (0, 0), (0, -1), 1, colors.black),
        ('LINEAFTER', (-1, 0), (-1, -1), 1, colors.black),
        ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.black),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
    ]))
    story.append(footer_table)

    doc.build(story)
    return buf.getvalue()
