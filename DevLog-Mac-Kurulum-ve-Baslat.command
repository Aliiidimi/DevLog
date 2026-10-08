#!/bin/bash
cd "$(dirname "$0")"

clear
echo "=========================================================="
echo "          DevLog - macOS Kurulum ve Baslatici             "
echo "=========================================================="
echo ""

# 1. Node.js Kontrolu
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js bulunamadi!"
    echo "DevLog'un Macbook'unuzda calismasi icin Node.js gereklidir."
    echo "Indirme sayfasi Safari'de aciliyor: https://nodejs.org"
    echo ""
    open "https://nodejs.org"
    echo "Lutfen Node.js LTS surumunu kurduktan sonra bu dosyayi tekrar acin."
    read -p "Cikmak icin Enter'a basin..."
    exit 1
fi

echo "✅ Node.js bulundu: $(node -v)"
echo "✅ npm bulundu: $(npm -v)"
echo ""

# 2. Paketlerin Yuklenmesi
if [ ! -d "node_modules" ]; then
    echo "📦 Ilk kurulum: macOS kutuphaneleri indiriliyor (lutfen bekleyin)..."
    npm install
    echo "✅ Kutuphaneler hazirlandi!"
    echo ""
fi

# 3. Calistirma / DMG Uretme
echo "----------------------------------------------------------"
echo "1) DevLog'u Simdi Baslat"
echo "2) macOS (.dmg) Kurulum Paketi Uret (Masaustune Kaydeder)"
echo "----------------------------------------------------------"
read -p "Seciminiz (1 veya 2 - Varsayilan: 1): " choice

if [ "$choice" == "2" ]; then
    echo ""
    echo "🍏 macOS (.dmg) kurulum paketi derleniyor..."
    npm run build:mac
    echo ""
    if ls dist/*.dmg 1> /dev/null 2>&1; then
        cp dist/*.dmg ~/Desktop/ 2>/dev/null || true
        echo "🎉 TEBRIKLER! DevLog.dmg dosyasi Macbook Masaustunuze kaydedildi!"
        open ~/Desktop
    else
        echo "Paket olusturuldu (dist klasorune bakabilirsiniz)."
        open dist
    fi
else
    echo ""
    echo "🚀 DevLog baslatiliyor..."
    npm start
fi
