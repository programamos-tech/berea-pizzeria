#!/usr/bin/env python3
"""Lee negocios-sincelejo-demo.csv y separa los negocios B2B y B2C."""

import csv
from collections import Counter
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1]
ARCHIVO = RAIZ / "negocios-sincelejo-demo.csv"
SALIDA = RAIZ / "salida-negocios"

COLUMNAS = [
    "id",
    "nombre",
    "tipo",
    "sector",
    "subcategoria",
    "barrio",
    "telefono",
    "whatsapp",
    "email",
    "contacto",
    "facturacion_anual_cop",
    "estado",
    "prioridad_comercial",
]


def leer_negocios(ruta: Path) -> list[dict[str, str]]:
    with ruta.open(newline="", encoding="utf-8") as archivo:
        return list(csv.DictReader(archivo))


def filtrar_por_tipo(negocios: list[dict[str, str]], tipo: str) -> list[dict[str, str]]:
    return [negocio for negocio in negocios if negocio["tipo"] == tipo]


def guardar_csv(ruta: Path, negocios: list[dict[str, str]]) -> None:
    ruta.parent.mkdir(parents=True, exist_ok=True)
    with ruta.open("w", newline="", encoding="utf-8") as archivo:
        writer = csv.DictWriter(archivo, fieldnames=COLUMNAS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(negocios)


def resumen(titulo: str, negocios: list[dict[str, str]]) -> None:
    print(f"\n{titulo}: {len(negocios)}")
    print("-" * 72)

    por_sector = Counter(negocio["sector"] for negocio in negocios)
    print("Por sector:")
    for sector, cantidad in por_sector.most_common():
        print(f"  {cantidad:4}  {sector}")

    facturacion = sum(int(negocio["facturacion_anual_cop"]) for negocio in negocios)
    print(f"Facturación anual sumada: ${facturacion:,.0f} COP")

    print("\nPrimeros 8:")
    for negocio in negocios[:8]:
        print(
            f"  {negocio['nombre']}"
            f" | {negocio['sector']}"
            f" | {negocio['barrio']}"
            f" | {negocio['estado']}"
            f" | {negocio['prioridad_comercial']}"
        )


def main() -> None:
    if not ARCHIVO.exists():
        raise SystemExit(f"No encontré el archivo: {ARCHIVO}")

    negocios = leer_negocios(ARCHIVO)
    b2b = filtrar_por_tipo(negocios, "B2B")
    b2c = filtrar_por_tipo(negocios, "B2C")

    print(f"Archivo: {ARCHIVO.name}")
    print(f"Total de negocios: {len(negocios)}")
    print(f"B2B: {len(b2b)}   B2C: {len(b2c)}   Otros: {len(negocios) - len(b2b) - len(b2c)}")

    resumen("B2B", b2b)
    resumen("B2C", b2c)

    guardar_csv(SALIDA / "negocios-b2b.csv", b2b)
    guardar_csv(SALIDA / "negocios-b2c.csv", b2c)
    print(f"\nCSV guardados en: {SALIDA}")


if __name__ == "__main__":
    main()
