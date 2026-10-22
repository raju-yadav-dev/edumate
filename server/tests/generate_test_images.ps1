Add-Type -AssemblyName System.Drawing

$width = 1100
$height = 350

# 1. Generate PNG with clear legible text
$bmp = New-Object System.Drawing.Bitmap($width, $height)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::White)
$font = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Regular)
$brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
$text = "CENTRAL LIBRARY NOTICE`n`nOperating hours: Monday to Friday from 9:00 AM to 8:00 PM.`nLocation: Room 204 Science Complex."
$g.DrawString($text, $font, $brush, (New-Object System.Drawing.PointF(50, 50)))
$bmp.Save("d:/EDUMATE/edumate/server/tests/test_library_notice.png", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()

# 2. Generate JPEG with clear legible text
$bmpJpg = New-Object System.Drawing.Bitmap($width, $height)
$gJpg = [System.Drawing.Graphics]::FromImage($bmpJpg)
$gJpg.Clear([System.Drawing.Color]::White)
$fontJpg = New-Object System.Drawing.Font("Segoe UI", 22, [System.Drawing.FontStyle]::Regular)
$brushJpg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::Black)
$textJpg = "DEPARTMENT OF COMPUTER SCIENCE`n`nLab Access Schedule: Saturday 10:00 AM to 4:00 PM.`nInstructor Dr Sharma Office Hours."
$gJpg.DrawString($textJpg, $fontJpg, $brushJpg, (New-Object System.Drawing.PointF(50, 50)))
$bmpJpg.Save("d:/EDUMATE/edumate/server/tests/test_cs_lab_notice.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$gJpg.Dispose()
$bmpJpg.Dispose()

# 3. Generate a blank / textless image for testing error handling
$bmpBlank = New-Object System.Drawing.Bitmap(300, 200)
$gBlank = [System.Drawing.Graphics]::FromImage($bmpBlank)
$gBlank.Clear([System.Drawing.Color]::LightGray)
$bmpBlank.Save("d:/EDUMATE/edumate/server/tests/test_blank_image.png", [System.Drawing.Imaging.ImageFormat]::Png)
$gBlank.Dispose()
$bmpBlank.Dispose()

Write-Host "Synthetic test images created successfully."
