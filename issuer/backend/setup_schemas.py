import httpx
import asyncio
import time

ACAPY_ADMIN_URL = "http://127.0.0.1:8020"

async def create_schema_and_cred_def(client, schema_name, attributes):
    try:
        # Generate a unique version so the ledger never rejects it as a duplicate
        unique_version = f"1.{int(time.time()) % 10000}"
        unique_tag = f"tag_{int(time.time()) % 10000}"

        # 1. Publish Schema
        print(f"\n[1/2] Publishing Schema: {schema_name} (v{unique_version})...")
        schema_res = await client.post(
            f"{ACAPY_ADMIN_URL}/schemas",
            json={
                "schema_name": schema_name,
                "schema_version": unique_version,
                "attributes": attributes
            },
            timeout=30.0
        )
        schema_id = schema_res.json()["schema_id"]
        print(f"      ✅ Schema ID: {schema_id}")

        print("      ⏳ Waiting for Ledger synchronization (3 seconds)...")
        time.sleep(3)

        # 2. Publish Credential Definition
        print(f"[2/2] Publishing Credential Definition...")
        cred_def_res = await client.post(
            f"{ACAPY_ADMIN_URL}/credential-definitions",
            json={
                "schema_id": schema_id,
                "tag": unique_tag,
                "support_revocation": False
            },
            timeout=30.0
        )
        cred_def_id = cred_def_res.json()["credential_definition_id"]
        print(f"      ✅ Cred Def ID: {cred_def_id}")

        return schema_id, cred_def_id
    except Exception as e:
        print(f"❌ Error creating {schema_name}: {e}")
        return None, None

async def main():
    print("🚀 INITIALIZING NEW ISSUER SCHEMAS ON BCOVRIN...")
    async with httpx.AsyncClient() as client:
        
        defi_s, defi_c = await create_schema_and_cred_def(
            client, "defi_trading_license", ["name", "role", "license_id", "expiration_date"]
        )

        pa_s, pa_c = await create_schema_and_cred_def(
            client, "personal_assistant_id", ["name", "assistant_id", "access_level", "expiration_date"]
        )

        med_s, med_c = await create_schema_and_cred_def(
            client, "medical_proxy_auth", ["patient_name", "proxy_name", "authorization_id", "valid_until"]
        )

        print("\n\n🎉 SUCCESS! COPY AND PASTE THIS NEW CONFIG INTO YOUR MAIN.PY FILES:")
        print("="*60)
        print("CRED_CONFIG = {")
        print(f'    "DeFiTradingLicense": {{\n        "schema_id": "{defi_s}",\n        "cred_def_id": "{defi_c}"\n    }},')
        print(f'    "PersonalAssistantID": {{\n        "schema_id": "{pa_s}",\n        "cred_def_id": "{pa_c}"\n    }},')
        print(f'    "MedicalProxyAuth": {{\n        "schema_id": "{med_s}",\n        "cred_def_id": "{med_c}"\n    }}')
        print("}")
        print("="*60)

if __name__ == "__main__":
    asyncio.run(main())