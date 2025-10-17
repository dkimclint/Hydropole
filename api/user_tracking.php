<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

try {
    $pdo = new PDO('mysql:host=localhost;dbname=hydropole','root','', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
} catch(PDOException $e) {
    echo json_encode(['status'=>'error','message'=>$e->getMessage()]);
    exit;
}

// Handle OPTIONS request for CORS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Read JSON input from POST (GPS device or GSM)
$input = file_get_contents('php://input');
$data = json_decode($input, true);




// Handle flood device data (POST)
if(isset($data['device_id'], $data['water_level'], $data['latitude'], $data['longitude'])) {
    try {
        // 1. Calculate status based on water level
        $water_level = floatval($data['water_level']);
        
        // Determine status name
        if ($water_level <= 1.0) {
            $status_name = 'safe';
        } elseif ($water_level <= 2.5) {
            $status_name = 'alert'; 
        } else {
            $status_name = 'danger';
        }

        // 2. Get message from status_types table instead of hardcoding
        $stmt_msg = $pdo->prepare("SELECT description FROM status_types WHERE status_name = ?");
        $stmt_msg->execute([$status_name]);
        $status_info = $stmt_msg->fetch(PDO::FETCH_ASSOC);
        
        $message = $status_info ? $status_info['description'] : 'Status update';

        // 3. Insert into flood_data table
        $stmt = $pdo->prepare("
            INSERT INTO flood_data 
            (device_id, water_level, status, message, gps_lat, gps_lng, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        ");
        $stmt->execute([
            $data['device_id'],
            $water_level,
            $status_name,
            $message,  // Now from status_types table!
            $data['latitude'],
            $data['longitude']
        ]);

        // 4. Check if status changed and log it
        $stmt2 = $pdo->prepare("
            SELECT status 
            FROM flood_data 
            WHERE device_id = ? 
            ORDER BY timestamp DESC 
            LIMIT 1,1
        ");
        $stmt2->execute([$data['device_id']]);
        $previous_record = $stmt2->fetch(PDO::FETCH_ASSOC);
        $old_status = $previous_record ? $previous_record['status'] : 'safe';

        // 5. If status changed, log to error log (replaces status_updates)
        if ($old_status !== $status_name) {
            error_log("FLOOD STATUS CHANGE: {$data['device_id']} - {$old_status} → {$status_name} at {$water_level} feet - {$message}");
        }
        


// 5. Update device location in hydropole_devices (CHANGED TO NEW TABLE)
$stmt4 = $pdo->prepare("
    UPDATE hydropole_devices  // CHANGED TO NEW TABLE
    SET current_lat = ?, current_lng = ?, is_online = 1 
    WHERE device_id = ?
");
$stmt4->execute([$data['latitude'], $data['longitude'], $data['device_id']]);

        echo json_encode([
            'status' => 'success',
            'new_status' => $status_name,
            'message' => $message,
            'water_level' => $water_level
        ]);
        exit;
        
    } catch(PDOException $e) {
        echo json_encode(['status'=>'error','message'=>$e->getMessage()]);
        exit;
    }
}


// If no valid request, return empty array
echo json_encode([]);
?>