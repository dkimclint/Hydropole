<?php
$host = "sql203.infinityfree.com";
$user = "if0_40192133";
$pass = "Hydropole112526";
$dbname = "if0_40192133_hydropole";

$conn = new mysqli($host, $user, $pass, $dbname);

if ($conn->connect_error) {
    die("❌ Connection failed: " . $conn->connect_error);
} else {
    echo "✅ Connected successfully to database!";
}
?>
