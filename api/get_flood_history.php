<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

try {
    $pdo = new PDO('mysql:host=localhost;dbname=hydropole','root','', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // Get device_id from request (optional)
    $device_id = $_GET['device_id'] ?? null;
    
    if ($device_id) {
        // Get history for specific device
        $stmt = $pdo->prepare("
            SELECT 
                fd.device_id, 
                hd.device_name,  
                fd.water_level, 
                fd.status, 
                fd.message, 
                fd.timestamp
            FROM flood_data fd
            LEFT JOIN hydropole_devices hd ON fd.device_id = hd.device_id
            WHERE fd.device_id = ?
            ORDER BY fd.timestamp DESC
            LIMIT 50
        ");
        $stmt->execute([$device_id]);
    } else {
        // Get recent history for all devices
        $stmt = $pdo->query("
            SELECT 
                fd.device_id, 
                hd.device_name,  
                fd.water_level, 
                fd.status, 
                fd.message, 
                fd.timestamp
            FROM flood_data fd
            LEFT JOIN hydropole_devices hd ON fd.device_id = hd.device_id
            ORDER BY fd.timestamp DESC
            LIMIT 100
        ");
    }
    
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'status' => 'success', 
        'data' => $history,
        'count' => count($history)
    ]);
    
} catch(PDOException $e) {
    echo json_encode([
        'status' => 'error', 
        'message' => $e->getMessage()
    ]);
}
?>