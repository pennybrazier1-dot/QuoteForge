import { describe, expect, it } from "vitest";
import { getEnquiryPropertyDetailRows } from "@/lib/enquiries/property-details";

describe("getEnquiryPropertyDetailRows", () => {
  it("renders full property details for the enquiry detail page", () => {
    const rows = getEnquiryPropertyDetailRows({
      addressLine1: "12 Oak Avenue",
      addressLine2: "Flat 2",
      city: "Northampton",
      county: "Northamptonshire",
      postcode: "NN1 1AA",
      propertyType: "House",
    });

    expect(rows).toEqual([
      { label: "Address", value: "12 Oak Avenue, Flat 2" },
      { label: "Town / City", value: "Northampton" },
      { label: "County", value: "Northamptonshire" },
      { label: "Postcode", value: "NN1 1AA" },
      { label: "Property type", value: "House" },
    ]);
  });

  it("shows not provided for missing optional location fields", () => {
    const rows = getEnquiryPropertyDetailRows({
      addressLine1: "4 Station Road",
      addressLine2: "",
      city: "",
      county: "",
      postcode: "NN17 1AB",
      propertyType: null,
    });

    expect(rows).toEqual([
      { label: "Address", value: "4 Station Road" },
      { label: "Town / City", value: "Not provided" },
      { label: "County", value: "Not provided" },
      { label: "Postcode", value: "NN17 1AB" },
      { label: "Property type", value: "Not provided" },
    ]);
  });
});
