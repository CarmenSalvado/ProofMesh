import { ImageResponse } from "next/og";

export const size = {
  width: 32,
  height: 32,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          background: "#171717",
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 20,
            fontWeight: 600,
            fontFamily: "system-ui, -apple-system, sans-serif",
            marginTop: -7,
          }}
        >
          ρ
        </span>
      </div>
    ),
    size
  );
}
