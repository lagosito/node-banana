/**
 * El Kiosk - Client Brand DNA API Route
 */
import { NextRequest, NextResponse } from "next/server";

const AIRTABLE_BASE_ID = "appuXgF7lJxG52Tqd";
const AIRTABLE_CLIENTS_TABLE = "tblZ0fnEbWD6zwqR0";
const AIRTABLE_BRAND_DNA_TABLE = "tbl1OX9uas15XkE5F";

const CLIENT_FIELDS = {
  clientName: "fld3CMtzrLHzyh4o7",
  firstName: "fldpzUpWe1fPZcAsl",
  email: "flduq9W3Y9225KgB5",
  website: "fld8Bg3lFaZ784E0U",
  status: "fldM2msRRMK8ZUHck",
  brandLogoUrl: "fldCJxFO1YVXgQi44",
  customizations: "fldVTf7BH3r8gPQ8R",
};

const BRAND_DNA_FIELDS = {
  clientName: "fld5qufpqh5yW5iCM",
  logo: "fldweRITXFq1tyuPK",
  primaryColor: "fldapYPbEGn6wSSez",
  secondaryColor: "fldUxcTeZNZEXlBZK",
  accentColor: "fldZNib8HwUIvvq9M",
  darkColor: "fldO8q5No4WRtyJCT",
  lightColor: "fldKFm88RAwQ2SeUf",
  displayFont: "fldELfSY6k5LNrXoe",
  bodyFont: "fldKBjWnzSQiA1Kb0",
  tagline: "fldKe5uC0dINBZVJF",
  toneTags: "fldOQ4eHQi87nIVqZ",
  aestheticTags: "fldnGmgjKwoFTWvKg",
  dos: "fldHtkiVEQxeIBktj",
  donts: "fld19eouP55wItmwa",
  status: "fldeDfsS9QGdk9lpU",
};

export interface ClientBrandDNA {
  clientName: string; firstName: string; email: string; website: string;
  status: string; brandLogoUrl: string; customizations: string;
  logo: string; primaryColor: string; secondaryColor: string; accentColor: string;
  darkColor: string; lightColor: string; displayFont: string; bodyFont: string;
  tagline: string; toneTags: string; aestheticTags: string; dos: string; donts: string;
}

async function airtableFetch(url: string) {
  const apiKey = process.env.AIRTABLE_API_KEY;
  if (!apiKey) throw new Error("AIRTABLE_API_KEY not configured");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Airtable error ${res.status}: ${err}`); }
  return res.json();
}

async function fetchAllClients() {
  const records: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams({
      "fields[]": CLIENT_FIELDS.clientName,
      "sort[0][field]": CLIENT_FIELDS.clientName,
      "sort[0][direction]": "asc",
      pageSize: "100",
    });
    params.append("fields[]", CLIENT_FIELDS.firstName);
    params.append("fields[]", CLIENT_FIELDS.status);
    if (offset) params.append("offset", offset);
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_CLIENTS_TABLE}?${params}`;
    const data = await airtableFetch(url);
    records.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return records;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const clientName = searchParams.get("name");

  try {
    if (!clientName) {
      const records = await fetchAllClients();
      const clients = records
        .map((r: AirtableRecord) => ({
          id: r.id,
          clientName: r.fields[CLIENT_FIELDS.clientName] || "",
          firstName: r.fields[CLIENT_FIELDS.firstName] || "",
          status: r.fields[CLIENT_FIELDS.status] || "",
        }))
        .filter((c) => c.clientName.trim() !== "");
      return NextResponse.json({ clients });
    }

    const encodedName = encodeURIComponent(clientName);
    const clientUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_CLIENTS_TABLE}?filterByFormula=LOWER({Client Name})=LOWER("${encodedName}")`;
    const clientData = await airtableFetch(clientUrl);

    if (!clientData.records || clientData.records.length === 0) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const cf = clientData.records[0].fields;
    const brandUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_BRAND_DNA_TABLE}?filterByFormula=LOWER({Client Name})=LOWER("${encodedName}")`;
    const brandData = await airtableFetch(brandUrl);
    const bf = brandData.records?.[0]?.fields || {};

    const result: ClientBrandDNA = {
      clientName: cf[CLIENT_FIELDS.clientName] || "",
      firstName: cf[CLIENT_FIELDS.firstName] || "",
      email: cf[CLIENT_FIELDS.email] || "",
      website: cf[CLIENT_FIELDS.website] || "",
      status: cf[CLIENT_FIELDS.status] || "",
      brandLogoUrl: cf[CLIENT_FIELDS.brandLogoUrl] || "",
      customizations: cf[CLIENT_FIELDS.customizations] || "",
      logo: bf[BRAND_DNA_FIELDS.logo] || "",
      primaryColor: bf[BRAND_DNA_FIELDS.primaryColor] || "",
      secondaryColor: bf[BRAND_DNA_FIELDS.secondaryColor] || "",
      accentColor: bf[BRAND_DNA_FIELDS.accentColor] || "",
      darkColor: bf[BRAND_DNA_FIELDS.darkColor] || "",
      lightColor: bf[BRAND_DNA_FIELDS.lightColor] || "",
      displayFont: bf[BRAND_DNA_FIELDS.displayFont] || "",
      bodyFont: bf[BRAND_DNA_FIELDS.bodyFont] || "",
      tagline: bf[BRAND_DNA_FIELDS.tagline] || "",
      toneTags: bf[BRAND_DNA_FIELDS.toneTags] || "",
      aestheticTags: bf[BRAND_DNA_FIELDS.aestheticTags] || "",
      dos: bf[BRAND_DNA_FIELDS.dos] || "",
      donts: bf[BRAND_DNA_FIELDS.donts] || "",
    };

    return NextResponse.json({ client: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

interface AirtableRecord { id: string; fields: Record<string, any>; }
