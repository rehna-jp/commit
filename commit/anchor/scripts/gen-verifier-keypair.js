#!/usr/bin/env node
// Generate an ed25519 keypair for the commit verification API signer.
// Outputs base58 keys for .env and raw bytes for VERIFIER_PUBKEY in lib.rs.
// No npm deps — uses Node's built-in crypto module.
"use strict";

const { generateKeyPairSync } = require("crypto");

// Base58 encode (Bitcoin/Solana alphabet)
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function encodeBase58(bytes) {
  let num = BigInt("0x" + Buffer.from(bytes).toString("hex") || "0");
  // Handle all-zero edge case
  if (bytes.every((b) => b === 0)) num = 0n;

  let encoded = "";
  while (num > 0n) {
    encoded = ALPHABET[Number(num % 58n)] + encoded;
    num /= 58n;
  }
  // Leading zero bytes → leading '1' characters
  for (const byte of bytes) {
    if (byte !== 0) break;
    encoded = "1" + encoded;
  }
  return encoded;
}

// Generate ed25519 keypair using Node's crypto module.
// DER layout for Ed25519:
//   SPKI public key:  44 bytes = 12-byte header + 32-byte pubkey
//   PKCS8 private key: 48 bytes = 16-byte header + 32-byte seed
const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
  privateKeyEncoding: { type: "pkcs8", format: "der" },
  publicKeyEncoding: { type: "spki", format: "der" },
});

const seedBytes = privateKey.slice(16);       // 32-byte private seed
const pubkeyBytes = publicKey.slice(12);      // 32-byte public key

// tweetnacl secret key = seed (32) || pubkey (32) = 64 bytes
const secretKeyBytes = Buffer.concat([seedBytes, pubkeyBytes]);

const secretKeyB58 = encodeBase58(secretKeyBytes);
const pubkeyB58 = encodeBase58(pubkeyBytes);

// Rust array literal for VERIFIER_PUBKEY constant in lib.rs
const rustBytes = `[${Array.from(pubkeyBytes).join(", ")}]`;

console.log("=".repeat(72));
console.log("  commit verification API keypair");
console.log("=".repeat(72));
console.log();
console.log("Add to your .env file:");
console.log();
console.log(`VERIFIER_PRIVATE_KEY=${secretKeyB58}`);
console.log(`NEXT_PUBLIC_VERIFIER_PUBLIC_KEY=${pubkeyB58}`);
console.log();
console.log("Update VERIFIER_PUBKEY in anchor/programs/commit/src/lib.rs:");
console.log();
console.log(`pub const VERIFIER_PUBKEY: [u8; 32] = ${rustBytes};`);
console.log();
console.log("=".repeat(72));
console.log("Keep VERIFIER_PRIVATE_KEY secret. Never commit it.");
console.log("=".repeat(72));
