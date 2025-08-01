import { executeQuerySingle } from "@/lib/db"
import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { sign } from "jsonwebtoken"
import { createHash } from "crypto"

// ฟังก์ชันสำหรับเข้ารหัสรหัสผ่านด้วย SHA-256
function hashPassword(password: string): string {
  return createHash("sha256").update(password).digest("hex")
}

// ฟังก์ชันสำหรับตรวจสอบรหัสผ่าน
function verifyPassword(password: string, hashedPassword: string): boolean {
  const hashed = hashPassword(password)
  console.log("Password verification:", {
    providedHashed: hashed.substring(0, 10) + "...",
    storedHashed: hashedPassword.substring(0, 10) + "...",
  })
  return hashed === hashedPassword
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    console.log("Login attempt:", { email })

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!email || !password) {
      console.log("Missing email or password")
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    // ตรวจสอบผู้ใช้ในฐานข้อมูล
    const user = await executeQuerySingle(
      `
    SELECT id, name, email, department, role, password
    FROM Users
    WHERE email = ?
    `,
      [email],
    )

    console.log("User found:", user ? "Yes" : "No")

    // ถ้าไม่พบผู้ใช้
    if (!user) {
      return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 })
    }

    // ตรวจสอบรหัสผ่าน
    const passwordMatch = verifyPassword(password, user.password)
    console.log("Password match:", passwordMatch)

    if (!passwordMatch) {
      return NextResponse.json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 })
    }

    // สร้าง JWT token
    const token = sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET || "your-secret-key",
      { expiresIn: "1d" },
    )

    console.log("Token created successfully")

    // ตั้งค่า cookie
    cookies().set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
      sameSite: "lax", // เปลี่ยนจาก strict เป็น lax เพื่อให้ทำงานได้กับ cross-site requests
      secure: process.env.NODE_ENV === "production",
    })

    console.log("Cookie set successfully")

    // สร้าง response object
    const response = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        department: user.department,
        role: user.role,
      },
      token: token, // ส่ง token กลับไปให้ client ด้วย
    })
    
    // ตั้งค่า cookie ใน response object โดยตรง
    response.cookies.set({
      name: "auth_token",
      value: token,
      httpOnly: true,
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    })
    
    return response
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 })
  }
}
