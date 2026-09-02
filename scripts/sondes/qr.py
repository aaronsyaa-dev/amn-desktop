"""Référence : la bibliothèque Python `qrcode` encode les mêmes textes, mode octets, version et masque imposés ; on écrit les matrices en JSON."""
import json, sys
import qrcode
from qrcode.util import QRData, MODE_8BIT_BYTE
from qrcode.constants import ERROR_CORRECT_L, ERROR_CORRECT_M
cas = [
  ("Bonjour", "L"), ("https://exemple.test/#/rdv?org=00000000-0000-4000-8000-000000000001", "M"),
  ("Salon d’essai — 12, rue des Lilas, 44000 Nantes. Du mardi au samedi.", "L"),
  ("x" * 150, "M"), ("é" * 100, "L"), ("y" * 200, "M"), ("z" * 260, "L"), ("w" * 271, "L"),
]
sortie = []
for texte, niveau in cas:
    for masque in range(8):
        qr = qrcode.QRCode(version=None, error_correction=ERROR_CORRECT_L if niveau == "L" else ERROR_CORRECT_M, box_size=1, border=0, mask_pattern=masque)
        qr.add_data(QRData(texte.encode("utf-8"), mode=MODE_8BIT_BYTE))
        qr.make(fit=True)
        m = qr.get_matrix()
        sortie.append({"texte": texte, "niveau": niveau, "version": qr.version, "masque": masque, "matrice": ["".join("1" if v else "0" for v in ligne) for ligne in m]})
json.dump(sortie, sys.stdout)
